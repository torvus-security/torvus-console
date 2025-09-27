import { createSupabaseServiceRoleClient } from '../supabase/admin';
import { normaliseStaffEmail } from '../auth/email';

export type StaffDirectoryEntry = {
  id: string;
  email: string;
  displayName: string;
  passkeyEnrolled: boolean;
  roles: string[];
};

export type StaffDirectoryQueryOptions = {
  q?: string;
  limit?: number;
  offset?: number;
};

function normaliseStaffRow(row: StaffUserRow, roleMap: Map<string, string[]>): StaffDirectoryEntry {
  const roles = roleMap.get(row.user_id) ?? [];
  return {
    id: row.user_id,
    email: row.email.toLowerCase(),
    displayName: row.display_name ?? row.email,
    passkeyEnrolled: Boolean(row.passkey_enrolled),
    roles
  };
}

type StaffUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  passkey_enrolled: boolean | null;
};

type StaffRoleMembershipRow = {
  user_id: string;
  valid_to: string | null;
  granted_via: string | null;
  staff_roles: {
    name: string;
  } | null;
};

function escapeILike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function fetchRolesForUserIds(userIds: string[]): Promise<Map<string, string[]>> {
  const roleMap = new Map<string, string[]>();

  if (!userIds.length) {
    return roleMap;
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await (supabase.from('staff_role_members') as any)
    .select('user_id, valid_to, granted_via, staff_roles ( name )')
    .in('user_id', userIds)
    .is('valid_to', null);

  if (error) {
    throw error;
  }

  const memberships = (data as StaffRoleMembershipRow[] | null) ?? [];
  for (const membership of memberships) {
    const grantedVia = membership.granted_via ?? 'normal';
    if (grantedVia !== 'normal' && grantedVia !== 'break_glass') {
      continue;
    }

    const roleName = membership.staff_roles?.name;
    if (!roleName) {
      continue;
    }

    if (!roleMap.has(membership.user_id)) {
      roleMap.set(membership.user_id, []);
    }

    roleMap.get(membership.user_id)!.push(roleName);
  }

  return roleMap;
}

export async function getCurrentStaffWithRoles(email: string): Promise<StaffDirectoryEntry | null> {
  const normalisedEmail = normaliseStaffEmail(email);
  if (!normalisedEmail) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await (supabase.from('staff_users') as any)
    .select('user_id, email, display_name, passkey_enrolled')
    .ilike('email', normalisedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const staffRow = (data as StaffUserRow | null) ?? null;

  if (!staffRow) {
    return null;
  }

  const roles = await fetchRolesForUserIds([staffRow.user_id]);

  return normaliseStaffRow(staffRow, roles);
}

export async function getStaffByIdWithRoles(userId: string): Promise<StaffDirectoryEntry | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await (supabase.from('staff_users') as any)
    .select('user_id, email, display_name, passkey_enrolled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const staffRow = (data as StaffUserRow | null) ?? null;

  if (!staffRow) {
    return null;
  }

  const roles = await fetchRolesForUserIds([userId]);

  return normaliseStaffRow(staffRow, roles);
}

export async function getAllStaffWithRoles({
  q,
  limit = 25,
  offset = 0
}: StaffDirectoryQueryOptions): Promise<{ staff: StaffDirectoryEntry[]; count: number }> {
  const supabase = createSupabaseServiceRoleClient();

  const query = (supabase.from('staff_users') as any)
    .select('user_id, email, display_name, passkey_enrolled', { count: 'exact' })
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (q && q.trim()) {
    const searchTerm = escapeILike(q.trim());
    query.or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const rows = (data as StaffUserRow[] | null) ?? [];
  const userIds = rows.map((row) => row.user_id);
  const roleMap = await fetchRolesForUserIds(userIds);

  return {
    staff: rows.map((row) => normaliseStaffRow(row, roleMap)),
    count: count ?? rows.length
  };
}
