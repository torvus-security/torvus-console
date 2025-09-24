import { cache } from 'react';
import type { NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  SupabaseConfigurationError,
  isSupabaseConfigured
} from './supabase';
import type { PermissionKey } from './rbac';
import { anonymiseEmail } from './analytics';
import { getCfAccessEmail } from './auth/cfAccess';
import { normaliseStaffEmail } from './auth/email';
import type { PostgrestLikeOrSupabase } from './types';
import { evaluateAccessGate } from './authz/gate';

type MaybeRecord = Record<string, unknown>;

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
  return normaliseStaffEmail(email);
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

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
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

  const email = sessionUser.email?.toLowerCase();
  if (!email) {
    return null;
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

  const evaluation = await evaluateAccessGate(email, { client: supabase });

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
