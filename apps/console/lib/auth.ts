import { cache } from 'react';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from './supabase';
import type { PermissionKey } from './rbac';
import { anonymiseEmail } from './analytics';

export type SessionUser = {
  id: string;
  email: string;
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
    email: data.user.email ?? 'unknown@torvussecurity.com'
  };
});

export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: staffRecord, error: staffError } = await supabase
    .from('staff_users')
    .select('user_id, email, display_name, passkey_enrolled')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (staffError) {
    console.error('Error loading staff user', staffError);
    throw new StaffAccessError('Unable to load staff profile', 503);
  }

  if (!staffRecord) {
    return null;
  }

  const { data: roleMemberships, error: roleMembershipError } = await supabase
    .from('staff_role_members')
    .select('role_id')
    .eq('user_id', sessionUser.id);

  if (roleMembershipError) {
    console.error('Error loading staff roles', roleMembershipError);
    throw new StaffAccessError('Unable to load staff roles', 503);
  }

  const roleIds = roleMemberships?.map((membership) => membership.role_id) ?? [];
  let roles: string[] = [];
  const permissionsSet = new Set<PermissionKey>();

  if (roleIds.length) {
    const { data: roleRows, error: roleError } = await supabase
      .from('staff_roles')
      .select('id, name')
      .in('id', roleIds);

    if (roleError) {
      console.error('Error loading staff role names', roleError);
      throw new StaffAccessError('Unable to resolve role names', 503);
    }

    roles = roleRows?.map((role) => role.name) ?? [];

    const { data: permissionRows, error: permissionError } = await supabase
      .from('staff_role_permissions')
      .select('permission_key, role_id')
      .in('role_id', roleIds);

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
    email: staffRecord.email,
    displayName: staffRecord.display_name,
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
