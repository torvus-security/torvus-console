import { NextResponse } from 'next/server';
import { getRequesterEmail, getUserRolesByEmail } from '../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

type RoleRow = {
  id: string;
  name: string | null;
  description: string | null;
};

type MemberRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  staff_role_members?: Array<
    | {
        staff_roles?: {
          name: string | null;
        } | null;
      }
    | null
  > | null;
};

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  let requesterRoles: string[];
  try {
    requesterRoles = await getUserRolesByEmail(email, supabase);
  } catch (error) {
    console.error('Failed to resolve requester roles', error);
    return new Response('failed to resolve roles', { status: 500 });
  }

  if (!hasSecurityAdminRole(requesterRoles)) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: roleRows, error: roleError } = await (supabase.from('staff_roles') as any)
    .select('id, name, description')
    .order('name', { ascending: true });

  if (roleError) {
    console.error('Failed to load staff roles', roleError);
    return new Response('failed to load roles', { status: 500 });
  }

  const { data: memberRows, error: memberError } = await (supabase.from('staff_users') as any)
    .select(
      `user_id, email, display_name,
        staff_role_members:staff_role_members (
          staff_roles:staff_roles ( name )
        )`
    )
    .order('email', { ascending: true });

  if (memberError) {
    console.error('Failed to load staff members', memberError);
    return new Response('failed to load members', { status: 500 });
  }

  const roles = ((roleRows as RoleRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ?? '',
    description: row.description?.trim() ?? ''
  }));

  roles.sort((a, b) => a.name.localeCompare(b.name));

  const members = ((memberRows as MemberRow[] | null) ?? []).map((row) => {
    const roleNames = (row.staff_role_members ?? [])
      .map((membership) => membership?.staff_roles?.name?.trim() ?? null)
      .filter((role): role is string => Boolean(role));

    roleNames.sort((a, b) => a.localeCompare(b));

    return {
      user_id: row.user_id,
      email: row.email.toLowerCase(),
      display_name: row.display_name,
      roles: Array.from(new Set(roleNames))
    };
  });

  return NextResponse.json({ roles, members });
}
