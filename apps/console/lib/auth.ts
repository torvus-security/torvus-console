import { cache } from 'react';
import { headers } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from './supabase';
import type { PermissionKey } from './rbac';
import { anonymiseEmail } from './analytics';

export type SessionUser = {
  id: string | null;
  email: string | null;
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

// Returns email from Cloudflare Access identity headers, if present.
function getCloudflareEmailFromHeaders(): string | null {
  const h = headers();
  // Primary header set by Cloudflare Access:
  const candidates = [
    'cf-access-authenticated-user-email',
    // Secondary fallbacks seen in some setups / proxies (best-effort):
    'x-authenticated-user-email',
    'x-auth-email',
    'x-forwarded-email'
  ];

  for (const name of candidates) {
    const v = h.get(name);
    if (v && typeof v === 'string' && v.trim()) {
      return v.trim().toLowerCase();
    }
  }
  return null;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Failed to resolve session user', error);
  }

  if (data?.user) {
    return {
      id: data.user.id,
      email: data.user.email ? data.user.email.toLowerCase() : null,
      user_metadata: data.user.user_metadata ?? undefined
    };
  }

  // Fallback: trust Cloudflare Access (already authenticated before reaching us)
  const cfEmail = getCloudflareEmailFromHeaders();
  if (cfEmail) {
    // No Supabase id yet; resolve to a staff row by email in getStaffUser()
    return { id: null, email: cfEmail };
  }

  return null;
});

export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();

  type StaffRecordRow = {
    user_id: string;
    email: string;
    display_name: string | null;
    passkey_enrolled: boolean | null;
  };

  let staffRecord: StaffRecordRow | null = null;

  if (sessionUser.id) {
    const { data, error } = await (supabase
      .from('staff_users') as any)
      .select('user_id, email, display_name, passkey_enrolled')
      .eq('user_id', sessionUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading staff user', error);
      throw new StaffAccessError('Unable to load staff profile', 503);
    }
    staffRecord = (data as StaffRecordRow | null) ?? null;
  }

  if (!staffRecord && sessionUser.email) {
    const { data, error } = await (supabase
      .from('staff_users') as any)
      .select('user_id, email, display_name, passkey_enrolled')
      .eq('email', sessionUser.email)
      .maybeSingle();

    if (error) {
      console.error('Error loading staff user', error);
      throw new StaffAccessError('Unable to load staff profile', 503);
    }
    staffRecord = (data as StaffRecordRow | null) ?? null;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('staff-lookup', {
      sessionUser: { id: sessionUser.id, email: sessionUser.email },
      found: Boolean(staffRecord)
    });
  }

  if (!staffRecord) {
    return null;
  }

  const userIdForQuery = staffRecord.user_id;

  const { data: roleMembershipRows, error: roleMembershipError } = await (supabase
    .from('staff_role_members') as any)
    .select('role_id')
    .eq('user_id', userIdForQuery);

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

  const resolvedEmail = (staffRecord.email ?? sessionUser.email ?? 'unknown@torvussecurity.com').toLowerCase();

  return {
    id: userIdForQuery,
    email: resolvedEmail,
    displayName:
      staffRecord.display_name ??
      (sessionUser.user_metadata?.name as string | undefined) ??
      resolvedEmail,
    passkeyEnrolled: Boolean(staffRecord.passkey_enrolled),
    roles,
    permissions: Array.from(permissionsSet),
    analyticsId: anonymiseEmail(resolvedEmail)
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
