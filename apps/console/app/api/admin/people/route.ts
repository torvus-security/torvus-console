import { NextResponse } from 'next/server';
import { getRequesterEmail, getUserRolesByEmail } from '../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  let roles: string[];
  try {
    roles = await getUserRolesByEmail(email, supabase);
  } catch (error) {
    return new Response('failed to resolve roles', { status: 500 });
  }

  const hasSecurityAdmin = roles.some((role) => role.toLowerCase() === 'security_admin');
  if (!hasSecurityAdmin) {
    return new Response('forbidden', { status: 403 });
  }

  type StaffRow = {
    user_id: string;
    email: string;
    display_name: string | null;
    passkey_enrolled: boolean | null;
    staff_role_members?: Array<{
      staff_roles?: {
        name: string | null;
      } | null;
    }> | null;
  };

  const { data, error } = await (supabase.from('staff_users') as any)
    .select(
      `user_id, email, display_name, passkey_enrolled,
        staff_role_members:staff_role_members (
          staff_roles:staff_roles ( name )
        )`
    )
    .is('staff_role_members.valid_to', null)
    .order('email', { ascending: true });

  if (error) {
    return new Response('failed to load staff', { status: 500 });
  }

  const rows = (data as StaffRow[] | null) ?? [];

  const staff = rows.map((row) => {
    const roleNames = (row.staff_role_members ?? [])
      .map((membership) => membership?.staff_roles?.name?.trim() ?? null)
      .filter((role): role is string => Boolean(role));

    roleNames.sort((a, b) => a.localeCompare(b));

    return {
      user_id: row.user_id,
      email: row.email.toLowerCase(),
      display_name: row.display_name,
      passkey_enrolled: Boolean(row.passkey_enrolled),
      roles: Array.from(new Set(roleNames))
    };
  });

  return NextResponse.json(staff);
}
