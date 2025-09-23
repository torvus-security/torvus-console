import { cache } from 'react';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from './supabase';
import type { PermissionKey } from './rbac';
import { anonymiseEmail } from './analytics';
import { getCfAccessEmail } from './auth/cfAccess';

export type PostgrestLikeOrSupabase = {
  from: (table: string) => unknown;
};

type MaybeRecord = Record<string, unknown>;

function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const direct = headers.get(name);
  if (direct) {
    return direct;
  }
  const lowerName = name.toLowerCase();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return null;
}

export function getRequesterEmail(req: Request | NextRequest): string | null {
  const headers = req.headers;
  const email =
    getHeaderCaseInsensitive(headers, 'x-authenticated-staff-email')
    ?? getHeaderCaseInsensitive(headers, 'x-session-user-email');
  return normaliseEmail(email);
}

export async function getUserRolesByEmail(
  email: string,
  client: PostgrestLikeOrSupabase
): Promise<string[]> {
  const normalisedEmail = normaliseEmail(email);
  if (!normalisedEmail) {
    return [];
  }

  type RoleMembershipRow = {
    staff_role_members?: Array<{
      valid_to: string | null;
      granted_via: string | null;
      staff_roles?: {
        name: string | null;
      } | null;
    }> | null;
  } | null;

  const query = (client.from('staff_users') as any)
    .select(
      `staff_role_members:staff_role_members (
        valid_to,
        granted_via,
        staff_roles:staff_roles ( name )
      )`
    )
    .eq('email', normalisedEmail)
    .maybeSingle();

  const { data, error } = (await query) as {
    data: RoleMembershipRow;
    error: { code?: string } | null;
  };

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const memberships = data?.staff_role_members ?? [];
  const now = new Date();
  const roles = memberships
    .filter((membership) => {
      const grantedVia = membership?.granted_via ?? 'normal';
      if (grantedVia !== 'normal' && grantedVia !== 'break_glass') {
        return false;
      }

      const validTo = membership?.valid_to ? new Date(membership.valid_to) : null;
      if (validTo && validTo <= now) {
        return false;
      }

      return true;
    })
    .map((membership) => membership?.staff_roles?.name?.trim() ?? null)
    .filter((role): role is string => Boolean(role));

  const uniqueRoles = Array.from(new Set(roles));
  uniqueRoles.sort((a, b) => a.localeCompare(b));
  return uniqueRoles;
}

export type StaffUserRecord = {
  user_id: string;
  email: string;
  display_name: string | null;
};

export async function getStaffUserByEmail(
  email: string,
  client: PostgrestLikeOrSupabase
): Promise<StaffUserRecord | null> {
  const normalisedEmail = normaliseEmail(email);
  if (!normalisedEmail) {
    return null;
  }

  const query = (client.from('staff_users') as any)
    .select('user_id, email, display_name')
    .eq('email', normalisedEmail)
    .maybeSingle();

  const { data, error } = (await query) as {
    data: StaffUserRecord | null;
    error: { code?: string } | null;
  };

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    user_id: data.user_id,
    email: data.email.toLowerCase(),
    display_name: data.display_name
  };
}

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

const FEATURE_REQUIRE_STAFF_SESSION = process.env.FEATURE_REQUIRE_STAFF_SESSION === 'true';

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Failed to resolve session user', error);
  }

  if (data?.user) {
    const isStaffSession = FEATURE_REQUIRE_STAFF_SESSION
      ? Boolean((data.user.user_metadata as MaybeRecord | undefined)?.is_staff)
      : true;

    if (!isStaffSession) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email ? data.user.email.toLowerCase() : null,
      user_metadata: data.user.user_metadata ?? undefined
    };
  }

  // Fallback: trust Cloudflare Access (already authenticated before reaching us)
  const allowCfFallback = !FEATURE_REQUIRE_STAFF_SESSION;
  const cfEmail = allowCfFallback ? await getCfAccessEmail() : null;
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
    .select('role_id, valid_to, granted_via')
    .eq('user_id', userIdForQuery);

  const roleMemberships = roleMembershipRows as Array<{
    role_id: string;
    valid_to: string | null;
    granted_via: string | null;
  }> | null;

  if (roleMembershipError) {
    console.error('Error loading staff roles', roleMembershipError);
    throw new StaffAccessError('Unable to load staff roles', 503);
  }

  const membershipCheckTime = new Date();
  const activeMemberships = (roleMemberships ?? []).filter((membership) => {
    const grantedVia = membership.granted_via ?? 'normal';
    if (grantedVia !== 'normal' && grantedVia !== 'break_glass') {
      return false;
    }

    if (!membership.valid_to) {
      return true;
    }

    const validTo = new Date(membership.valid_to);
    return validTo > membershipCheckTime;
  });

  const roleIds = activeMemberships.map((membership) => membership.role_id);
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
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new StaffAccessError('Authentication required', 401);
  }

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
