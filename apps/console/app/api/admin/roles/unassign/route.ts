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
    console.error('Failed to resolve role for unassignment', roleError);
    return new Response('failed to resolve role', { status: 500 });
  }

  if (!roleRow) {
    return NextResponse.json({ error: `Role ${roleName} not found` }, { status: 404 });
  }

  const roleData = roleRow as StaffRoleRow;
  const roleId = roleData.id;
  const canonicalRoleName = (roleData.name || normalisedRole).trim();

  const membershipQuery = (supabase.from('staff_role_members') as any)
    .select('user_id')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .is('valid_to', null)
    .maybeSingle();

  const { data: membershipRow, error: membershipError } = await membershipQuery;

  if (membershipError && membershipError.code !== 'PGRST116') {
    console.error('Failed to check existing membership', membershipError);
    return new Response('failed to check membership', { status: 500 });
  }

  const isMember = Boolean(membershipRow);

  if (!isMember) {
    return NextResponse.json({ success: true, role_name: canonicalRoleName, removed: false });
  }

  if (canonicalRoleName.toLowerCase() === 'security_admin') {
    const { data: adminRows, error: adminError } = await (supabase.from('staff_role_members') as any)
      .select('user_id')
      .eq('role_id', roleId)
      .is('valid_to', null);

    if (adminError) {
      console.error('Failed to evaluate security_admin membership', adminError);
      return new Response('failed to check security_admin membership', { status: 500 });
    }

    const adminCount = (adminRows ?? []).length;
    if (adminCount <= 1) {
      return NextResponse.json(
        {
          error: 'Cannot remove the last security_admin. Assign another administrator before removing this role.'
        },
        { status: 409 }
      );
    }
  }

  const { error: deleteError } = await (supabase.from('staff_role_members') as any)
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .is('valid_to', null);

  if (deleteError) {
    console.error('Failed to unassign role', deleteError);
    return new Response('failed to unassign role', { status: 500 });
  }

  try {
    await logAudit(
      {
        action: 'role_unassign',
        targetType: 'user',
        targetId: userId,
        meta: { role_name: canonicalRoleName }
      },
      request
    );
  } catch (error) {
    console.error('Failed to log audit entry for role removal', error);
  }

  return NextResponse.json({ success: true, role_name: canonicalRoleName, removed: true });
}
