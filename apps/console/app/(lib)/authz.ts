import { SupabaseConfigurationError, isSupabaseConfigured, isTransientSupabaseError } from '../../lib/supabase';
import { createSupabaseServiceRoleClient } from '../../lib/supabase/admin';
import { getSessionUser } from '../../lib/auth';
import { normaliseStaffEmail } from '../../lib/auth/email';
import { getDevStaffConfig } from '../../lib/devStaff';

export type AuthzResult = {
  email: string | null;
  userId: string | null;
  displayName: string | null;
  roles: string[];
  rolesLower: string[];
  enrolled: boolean;
  verified: boolean;
  status: string | null;
  passkeyEnrolled: boolean;
  allowed: boolean;
};

type StaffRoleMembershipRow = {
  valid_to: string | null;
  granted_via: string | null;
  staff_roles: { name: string | null } | null;
} | null;

type StaffRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  enrolled: boolean | null;
  verified: boolean | null;
  status: string | null;
  passkey_enrolled: boolean | null;
  staff_role_members: StaffRoleMembershipRow[] | null;
} | null;

function normaliseRoles(memberships: StaffRoleMembershipRow[] | null | undefined): string[] {
  if (!memberships?.length) {
    return [];
  }

  const now = Date.now();

  const roles = memberships
    .filter((membership): membership is NonNullable<StaffRoleMembershipRow> => Boolean(membership))
    .filter((membership) => {
      if (membership.valid_to) {
        const validTo = new Date(membership.valid_to);
        if (Number.isNaN(validTo.getTime()) || validTo.getTime() < now) {
          return false;
        }
      }

      const grantedVia = (membership.granted_via ?? 'normal').toLowerCase();
      if (grantedVia !== 'normal' && grantedVia !== 'break_glass') {
        return false;
      }

      return Boolean(membership.staff_roles?.name);
    })
    .map((membership) => membership.staff_roles!.name!.trim())
    .filter((role) => role.length > 0);

  const uniqueRoles = Array.from(new Set(roles));
  uniqueRoles.sort((a, b) => a.localeCompare(b));
  return uniqueRoles;
}

let missingConfigWarned = false;

function noteMissingSupabaseConfig(error: unknown): boolean {
  if (!(error instanceof SupabaseConfigurationError)) {
    return false;
  }

  if (!missingConfigWarned) {
    console.warn('[authz] Supabase configuration missing; unable to evaluate roles.', {
      missing: error.missing
    });
    missingConfigWarned = true;
  }

  return true;
}

export async function loadAuthz(): Promise<AuthzResult> {
  const sessionUser = await getSessionUser();
  const sessionEmail = normaliseStaffEmail(sessionUser?.email ?? null);

  const emptyResult: AuthzResult = {
    email: sessionEmail,
    userId: null,
    displayName: null,
    roles: [],
    rolesLower: [],
    enrolled: false,
    verified: false,
    status: null,
    passkeyEnrolled: false,
    allowed: false
  };

  if (!sessionEmail) {
    return emptyResult;
  }

  const devStaff = getDevStaffConfig();
  if (devStaff && devStaff.email === sessionEmail) {
    const roles = [...devStaff.roles];
    const rolesLower = roles.map((role) => role.toLowerCase());
    const allowed = devStaff.enrolled && devStaff.verified && devStaff.status === 'active';
    return {
      email: devStaff.email,
      userId: devStaff.id,
      displayName: devStaff.displayName,
      roles,
      rolesLower,
      enrolled: devStaff.enrolled,
      verified: devStaff.verified,
      status: devStaff.status,
      passkeyEnrolled: devStaff.passkeyEnrolled,
      allowed
    };
  }

  if (!isSupabaseConfigured()) {
    return emptyResult;
  }

  let supabase;
  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (error) {
    if (noteMissingSupabaseConfig(error)) {
      return emptyResult;
    }
    throw error;
  }

  let data: StaffRow;
  let error: { code?: string } | null = null;

  try {
    ({ data, error } = (await (supabase.from('staff_users') as any)
      .select(
        `user_id,
         email,
         display_name,
         enrolled,
         verified,
         status,
         passkey_enrolled,
         staff_role_members:staff_role_members!left(
           valid_to,
           granted_via,
           staff_roles:staff_roles ( name )
         )`
      )
      .ilike('email', sessionEmail)
      .maybeSingle()) as { data: StaffRow; error: { code?: string } | null });
  } catch (unknownError) {
    if (isTransientSupabaseError(unknownError)) {
      console.warn('[authz] transient Supabase error while loading authz; returning empty result', unknownError);
      return emptyResult;
    }
    throw unknownError;
  }

  if (error && error.code !== 'PGRST116') {
    console.error('[authz] failed to load staff authz record', error);
    throw error;
  }

  if (!data) {
    return emptyResult;
  }

  const roles = normaliseRoles(data.staff_role_members);
  const rolesLower = roles.map((role) => role.toLowerCase());

  const enrolled = Boolean(data.enrolled);
  const verified = Boolean(data.verified);
  const status = data.status?.trim() ?? null;
  const passkeyEnrolled = Boolean(data.passkey_enrolled);

  const allowed = Boolean(data) && enrolled && verified && status === 'active';

  return {
    email: data.email.toLowerCase(),
    userId: data.user_id,
    displayName: data.display_name,
    roles,
    rolesLower,
    enrolled,
    verified,
    status,
    passkeyEnrolled,
    allowed
  };
}

type RoleCheck = {
  anyOf?: string[];
  allOf?: string[];
  context?: string;
};

function normaliseRoleList(list: string[] | undefined): string[] {
  return (list ?? []).map((role) => role.toLowerCase());
}

export function authorizeRoles(result: AuthzResult, check: RoleCheck): boolean {
  const lowerRoles = new Set(result.rolesLower);
  const anyOf = normaliseRoleList(check.anyOf);
  const allOf = normaliseRoleList(check.allOf);

  let allowed = true;

  if (allOf.length) {
    allowed = allOf.every((role) => lowerRoles.has(role));
  }

  if (allowed && anyOf.length) {
    allowed = anyOf.some((role) => lowerRoles.has(role));
  }

  if (!allowed) {
    console.warn('[authz] missing required roles', {
      context: check.context ?? 'page',
      email: result.email,
      requiredAny: anyOf.length ? anyOf : null,
      requiredAll: allOf.length ? allOf : null,
      assigned: result.roles
    });
  }

  return allowed;
}
