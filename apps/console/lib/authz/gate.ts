import { createSupabaseServiceRoleClient } from '../supabase';
import type { PostgrestLikeOrSupabase } from '../types';
import { normaliseStaffEmail } from '../auth/email';

function isDebugLoggingEnabled(): boolean {
  return (process.env.LOG_LEVEL ?? '').toLowerCase() === 'debug';
}

export type AccessFlags = {
  enrolled: boolean;
  verified: boolean;
  status: string;
  passkey_enrolled: boolean;
};

export type AccessGateEvaluation = {
  email: string;
  userId: string | null;
  displayName: string | null;
  allowed: boolean;
  reasons: string[];
  flags: AccessFlags;
  roles: string[];
  roleIds: string[];
};

type StaffRoleMembershipRow = {
  role_id: string | null;
  valid_to: string | null;
  staff_roles?: {
    name: string | null;
  } | null;
} | null;

type StaffUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  enrolled: boolean | null;
  verified: boolean | null;
  status: string | null;
  passkey_enrolled: boolean | null;
  staff_role_members: StaffRoleMembershipRow[] | null;
} | null;

export async function evaluateAccessGate(
  normalisedEmail: string,
  options?: { client?: PostgrestLikeOrSupabase }
): Promise<AccessGateEvaluation> {
  const email = normaliseStaffEmail(normalisedEmail) ?? '';

  if (!email) {
    const result: AccessGateEvaluation = {
      email: '',
      userId: null,
      displayName: null,
      allowed: false,
      reasons: ['missing email'],
      flags: {
        enrolled: false,
        verified: false,
        status: 'unknown',
        passkey_enrolled: false
      },
      roles: [],
      roleIds: []
    };

    if (isDebugLoggingEnabled()) {
      console.debug('[authz] gate deny', { email, reasons: result.reasons });
    }

    return result;
  }

  const supabase = (options?.client ?? createSupabaseServiceRoleClient()) as PostgrestLikeOrSupabase;

  const query = (supabase.from('staff_users') as any)
    .select(
      `user_id,
      email,
      display_name,
      enrolled,
      verified,
      status,
      passkey_enrolled,
      staff_role_members:staff_role_members!left(
        role_id,
        valid_to,
        staff_roles:staff_roles ( name )
      )`
    )
    .ilike('email', email)
    .is('staff_role_members.valid_to', null)
    .maybeSingle();

  const { data, error } = (await query) as {
    data: StaffUserRow;
    error: { code?: string } | null;
  };

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const staffRow = data ?? null;

  const flags: AccessFlags = {
    enrolled: Boolean(staffRow?.enrolled),
    verified: Boolean(staffRow?.verified),
    status: staffRow?.status?.trim() ?? 'unknown',
    passkey_enrolled: Boolean(staffRow?.passkey_enrolled)
  };

  const now = Date.now();

  const memberships = (staffRow?.staff_role_members ?? []).filter((membership) => {
    if (!membership) {
      return false;
    }

    if (membership.valid_to) {
      const validTo = new Date(membership.valid_to);

      if (Number.isNaN(validTo.getTime())) {
        return false;
      }

      if (validTo.getTime() < now) {
        return false;
      }
    }

    return Boolean(membership.role_id);
  });

  const roles = memberships
    .map((membership) => membership?.staff_roles?.name?.trim())
    .filter((role): role is string => Boolean(role));

  const uniqueRoles = Array.from(new Set(roles));
  uniqueRoles.sort((a, b) => a.localeCompare(b));

  const roleIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership?.role_id)
        .filter((roleId): roleId is string => Boolean(roleId))
    )
  );

  const reasons: string[] = [];

  if (!staffRow) {
    reasons.push('staff record not found');
  } else {
    if (!flags.enrolled) {
      reasons.push('enrollment incomplete');
    }

    if (!flags.verified) {
      reasons.push('account not verified');
    }

    if (flags.status !== 'active') {
      reasons.push(`staff status is ${flags.status}`);
    }
  }

  const lowerRoles = uniqueRoles.map((role) => role.toLowerCase());
  const hasSecurityAdmin = lowerRoles.includes('security_admin');
  const hasAuditor = lowerRoles.includes('auditor');

  if (staffRow && !hasSecurityAdmin && !hasAuditor) {
    reasons.push('missing required role security_admin or auditor');
  }

  if (staffRow && !flags.passkey_enrolled) {
    reasons.push('passkey enrollment pending (informational)');
  }

  const allowed =
    staffRow !== null &&
    flags.enrolled &&
    flags.verified &&
    flags.status === 'active' &&
    (hasSecurityAdmin || hasAuditor);

  if (!allowed && isDebugLoggingEnabled()) {
    console.debug('[authz] gate deny', {
      email,
      reasons,
      flags,
      roles: uniqueRoles
    });
  }

  return {
    email,
    userId: staffRow?.user_id ?? null,
    displayName: staffRow?.display_name ?? null,
    allowed,
    reasons,
    flags,
    roles: uniqueRoles,
    roleIds
  };
}
