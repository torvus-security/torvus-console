import { headers } from 'next/headers';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  SupabaseConfigurationError,
  isSupabaseConfigured,
  isTransientSupabaseError
} from './supabase';
import type { PermissionKey } from './rbac';
import { expandPermissionsForRoles } from './rbac';
import { anonymiseEmail } from './analytics';
import { normaliseStaffEmail } from './auth/email';
import type { PostgrestLikeOrSupabase } from './types';
import { evaluateAccessGate } from './authz/gate';
import { getDevStaffConfig } from './devStaff';

type MaybeRecord = Record<string, unknown>;

export type RequesterIdentity = {
  email?: string;
  source: 'cloudflare' | 'torvus' | 'anonymous';
};

function resolveIdentityFromHeaders(headerBag: Headers | null | undefined): RequesterIdentity {
  const checks: Array<{ header: string; source: RequesterIdentity['source'] }> = [
    { header: 'x-torvus-console-email', source: 'torvus' },
    { header: 'cf-access-authenticated-user-email', source: 'cloudflare' },
    { header: 'x-authenticated-user-email', source: 'cloudflare' }
  ];

  for (const { header, source } of checks) {
    if (!headerBag) {
      break;
    }

    const rawValue = headerBag.get(header);
    const normalised = normaliseStaffEmail(rawValue);

    if (normalised) {
      return { email: normalised, source };
    }
  }

  return { source: 'anonymous' };
}

export function getIdentityFromRequestHeaders(headerBag?: Headers | null): RequesterIdentity {
  if (headerBag) {
    return resolveIdentityFromHeaders(headerBag);
  }

  try {
    return resolveIdentityFromHeaders(headers());
  } catch (error) {
    console.warn('Unable to access request headers for identity resolution', error);
    return { source: 'anonymous' };
  }
}

export async function getUserRolesByEmail(
  email: string,
  client: PostgrestLikeOrSupabase
): Promise<string[]> {
  const normalisedEmail = normaliseStaffEmail(email);
  if (!normalisedEmail) {
    return [];
  }

  const evaluation = await evaluateAccessGate(normalisedEmail, { client });
  return evaluation.roles;
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
  const normalisedEmail = normaliseStaffEmail(email);
  if (!normalisedEmail) {
    return null;
  }

  const query = (client.from('staff_users') as any)
    .select('user_id, email, display_name')
    .ilike('email', normalisedEmail)
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

let supabaseConfigWarningLogged = false;

function noteMissingSupabaseConfig(error: unknown): boolean {
  if (!(error instanceof SupabaseConfigurationError)) {
    return false;
  }

  if (!supabaseConfigWarningLogged) {
    console.warn('Supabase configuration is incomplete; continuing without Supabase-backed data.', {
      missing: error.missing
    });
    supabaseConfigWarningLogged = true;
  }

  return true;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  let supabase: ReturnType<typeof createSupabaseServerClient> | null = null;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (!noteMissingSupabaseConfig(error)) {
      throw error;
    }
    return null;
  }

  if (!supabase) {
    return null;
  }

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
  const devStaff = getDevStaffConfig();
  if (devStaff) {
    return {
      id: devStaff.id,
      email: devStaff.email,
      user_metadata: { name: devStaff.displayName }
    };
  }

  if (allowCfFallback) {
    const identity = getIdentityFromRequestHeaders();
    if (identity.email) {
      return {
        id: null,
        email: identity.email,
        user_metadata: { identitySource: identity.source }
      };
    }
  }

  return null;
}

export async function getStaffUser(): Promise<StaffUser | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const email = sessionUser.email?.toLowerCase();
  if (!email) {
    return null;
  }

  const devStaff = getDevStaffConfig();
  if (devStaff && devStaff.email === email) {
    const permissions = expandPermissionsForRoles(devStaff.roles);
    return {
      id: devStaff.id,
      email: devStaff.email,
      displayName: devStaff.displayName,
      passkeyEnrolled: devStaff.passkeyEnrolled,
      roles: devStaff.roles,
      permissions,
      analyticsId: anonymiseEmail(devStaff.email)
    };
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  let supabase: ReturnType<typeof createSupabaseServiceRoleClient> | null = null;

  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (error) {
    if (!noteMissingSupabaseConfig(error)) {
      throw error;
    }
    return null;
  }

  if (!supabase) {
    return null;
  }

  let evaluation: Awaited<ReturnType<typeof evaluateAccessGate>>;

  try {
    evaluation = await evaluateAccessGate(email, { client: supabase });
  } catch (error) {
    if (isTransientSupabaseError(error)) {
      console.warn('Unable to evaluate staff access via Supabase; falling back to dev configuration if available.', error);
      if (devStaff && devStaff.email === email) {
        const permissions = expandPermissionsForRoles(devStaff.roles);
        return {
          id: devStaff.id,
          email: devStaff.email,
          displayName: devStaff.displayName,
          passkeyEnrolled: devStaff.passkeyEnrolled,
          roles: devStaff.roles,
          permissions,
          analyticsId: anonymiseEmail(devStaff.email)
        };
      }
      return null;
    }
    throw error;
  }

  if (!evaluation.allowed || !evaluation.userId) {
    return null;
  }

  const roleIds = evaluation.roleIds;
  const roles = evaluation.roles;
  const permissionsSet = new Set<PermissionKey>();

  if (roleIds.length) {
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

  const resolvedEmail = evaluation.email;

  return {
    id: evaluation.userId,
    email: resolvedEmail,
    displayName:
      evaluation.displayName ??
      (sessionUser.user_metadata?.name as string | undefined) ??
      resolvedEmail,
    passkeyEnrolled: evaluation.flags.passkey_enrolled,
    roles,
    permissions: Array.from(permissionsSet),
    analyticsId: anonymiseEmail(resolvedEmail)
  };
}

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

export async function isAdminSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase configuration missing; unable to verify administrator session.');
    return false;
  }

  let supabase: ReturnType<typeof createSupabaseServerClient> | null = null;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (noteMissingSupabaseConfig(error)) {
      return false;
    }
    throw error;
  }

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_admin');

  if (error) {
    console.error('Failed to verify administrator session', error);
    throw new StaffAccessError('Unable to verify administrator privileges', 503);
  }

  return data === true;
}

export async function ensureAdminSession(): Promise<void> {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    throw new StaffAccessError('Administrator privileges required', 403);
  }
}

export async function requireAdminStaff(options?: { permission?: PermissionKey }): Promise<StaffUser> {
  const staffUser = await requireStaff(options);
  await ensureAdminSession();
  return staffUser;
}

export async function ensurePasskeyEnrolled(): Promise<boolean> {
  const staffUser = await getStaffUser();
  return Boolean(staffUser?.passkeyEnrolled);
}
