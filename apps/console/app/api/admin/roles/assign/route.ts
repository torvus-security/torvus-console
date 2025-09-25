import { NextResponse } from 'next/server';
import { getIdentityFromRequestHeaders, getUserRolesByEmail } from '../../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../../lib/supabase';
import { logAudit } from '../../../../../server/audit';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

type StaffRoleRow = {
  id: string;
  name: string;
};

export async function POST(request: Request) {
  const { email } = getIdentityFromRequestHeaders(request.headers);
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const userId = typeof (payload as any)?.user_id === 'string' ? (payload as any).user_id.trim() : '';
  const roleName = typeof (payload as any)?.role_name === 'string' ? (payload as any).role_name.trim() : '';

  if (!userId || !roleName) {
    return NextResponse.json({ error: 'user_id and role_name are required' }, { status: 400 });
  }

  const normalisedRole = roleName.toLowerCase();

  const { data: roleRow, error: roleError } = await (supabase.from('staff_roles') as any)
    .select('id, name')
    .eq('name', normalisedRole)
    .maybeSingle();

  if (roleError && roleError.code !== 'PGRST116') {
    console.error('Failed to resolve role for assignment', roleError);
    return new Response('failed to resolve role', { status: 500 });
  }

  if (!roleRow) {
    return NextResponse.json({ error: `Role ${roleName} not found` }, { status: 404 });
  }

  const { data: userRow, error: userError } = await (supabase.from('staff_users') as any)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError && userError.code !== 'PGRST116') {
    console.error('Failed to resolve staff user for assignment', userError);
    return new Response('failed to resolve user', { status: 500 });
  }

  if (!userRow) {
    return NextResponse.json({ error: `Staff user ${userId} not found` }, { status: 404 });
  }

  const roleData = roleRow as StaffRoleRow;
  const roleId = roleData.id;
  const canonicalRoleName = (roleData.name || normalisedRole).trim();

  const { error: upsertError } = await (supabase.from('staff_role_members') as any)
    .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id,role_id' });

  if (upsertError) {
    console.error('Failed to assign role', upsertError);
    return new Response('failed to assign role', { status: 500 });
  }

  try {
    await logAudit(
      {
        action: 'role_assign',
        targetType: 'user',
        targetId: userId,
        meta: { role_name: canonicalRoleName }
      },
      request
    );
  } catch (error) {
    console.error('Failed to log audit entry for role assignment', error);
  }

  return NextResponse.json({ success: true, role_name: canonicalRoleName });
}
