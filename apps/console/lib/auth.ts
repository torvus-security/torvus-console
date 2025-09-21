import { cache } from 'react';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from './supabase';
import type { PermissionKey } from './rbac';
import { anonymiseEmail } from './analytics';

export type SessionUser = {
  id: string;
  email: string;
  user_metadata?: { name?: string } & Record<string, unknown>;
};

export type StaffUser = {
  id: string;
  email: string;
  displayName: string;
  passkeyEnrolled: boolean;
  roles: string[];
  permissions: PermissionKey[];
  analyticsId: string;
};

export class StaffAccessError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
    this.name = 'StaffAccessError';
  }
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Failed to resolve session user', error);
    return null;
  }
  if (!data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? 'unknown@torvussecurity.com',
    user_metadata: data.user.user_metadata ?? undefined
  };
});

export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: staffRecordRaw, error: staffError } = await (supabase
    .from('staff_users') as any)
    .select('user_id, email, display_name, passkey_enrolled')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (staffError) {
    console.error('Error loading staff user', staffError);
    throw new StaffAccessError('Unable to load staff profile', 503);
  }

  type StaffRecordRow = {
    user_id: string;
    email: string;
    display_name: string;
    passkey_enrolled: boolean;
  };

  let staffRecordData = staffRecordRaw as StaffRecordRow | null;

  if (!staffRecordData && sessionUser.email) {
    const { data: byEmail } = await (supabase
      .from('staff_users') as any)
      .select('user_id, email, display_name, passkey_enrolled')
      .eq('email', (sessionUser.email || '').toLowerCase())
      .maybeSingle();

    staffRecordData = (byEmail as StaffRecordRow | null) || null;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('staff-lookup', {
      sessionUser: { id: sessionUser.id, email: sessionUser.email },
      found: Boolean(staffRecordData)
    });
  }

  const staffRecord = staffRecordData;

  if (!staffRecord) {
    return null;
  }

  const { data: roleMembershipRows, error: roleMembershipError } = await (supabase
    .from('staff_role_members') as any)
    .select('role_id')
    .eq('user_id', staffRecord.user_id);

  const roleMemberships = roleMembershipRows as Array<{ role_id: string }> | null;

  if (roleMembershipError) {
    console.error('Error loading staff roles', roleMembershipError);
    throw new StaffAccessError('Unable to load staff roles', 503);
  }

  const roleIds = roleMemberships?.map((membership) => membership.role_id) ?? [];
  let roles: string[] = [];
  const permissionsSet = new Set<PermissionKey>();

  if (roleIds.length) {
    const { data: roleRowsData, error: roleError } = await (supabase
      .from('staff_roles') as any)
      .select('id, name')
      .in('id', roleIds);

    const roleRows = roleRowsData as Array<{ id: string; name: string }> | null;

    if (roleError) {
      console.error('Error loading staff role names', roleError);
      throw new StaffAccessError('Unable to resolve role names', 503);
    }

    roles = roleRows?.map((role) => role.name) ?? [];

    const { data: permissionRowsData, error: permissionError } = await (supabase
      .from('staff_role_permissions') as any)
      .select('permission_key, role_id')
      .in('role_id', roleIds);

    const permissionRows = permissionRowsData as Array<{ permission_key: string; role_id: string }> | null;

    if (permissionError) {
      console.error('Error loading staff permissions', permissionError);
      throw new StaffAccessError('Unable to load staff permissions', 503);
    }

    permissionRows?.forEach((row) => {
      permissionsSet.add(row.permission_key as PermissionKey);
    });
  }

  return {
    id: staffRecord.user_id,
    email: staffRecord.email ?? sessionUser.email!,
    displayName:
      staffRecord.display_name ??
      (sessionUser.user_metadata?.name as string | undefined) ??
      sessionUser.email!,
    passkeyEnrolled: staffRecord.passkey_enrolled,
    roles,
    permissions: Array.from(permissionsSet),
    analyticsId: anonymiseEmail(staffRecord.email)
  };
});

export async function requireStaff(options?: { permission?: PermissionKey }): Promise<StaffUser> {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    throw new StaffAccessError('Staff membership required', 403);
  }

  if (options?.permission && !staffUser.permissions.includes(options.permission)) {
    throw new StaffAccessError(`Missing required permission: ${options.permission}`, 403);
  }

  return staffUser;
}

export async function ensurePasskeyEnrolled(): Promise<boolean> {
  const staffUser = await getStaffUser();
  return Boolean(staffUser?.passkeyEnrolled);
}
