import { normaliseStaffEmail } from './auth/email';
import type { RoleKey } from './rbac';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalised = value.trim().toLowerCase();
  if (!normalised) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'y', 'on'].includes(normalised)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off'].includes(normalised)) {
    return false;
  }

  return fallback;
}

const ALL_ROLES: RoleKey[] = [
  'viewer',
  'auditor',
  'operator',
  'investigator',
  'security_admin',
  'break_glass'
];

function parseRoles(value: string | undefined): RoleKey[] {
  if (!value) {
    return ['security_admin'];
  }

  const requested = value
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);

  const unique = Array.from(new Set(requested));
  const roles: RoleKey[] = [];
  for (const role of unique) {
    if (ALL_ROLES.includes(role as RoleKey)) {
      roles.push(role as RoleKey);
    }
  }

  return roles.length ? roles : ['security_admin'];
}

export type DevStaffConfig = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleKey[];
  enrolled: boolean;
  verified: boolean;
  status: string;
  passkeyEnrolled: boolean;
};

export function getDevStaffConfig(): DevStaffConfig | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const email = normaliseStaffEmail(process.env.DEV_STAFF_EMAIL ?? null);
  if (!email) {
    return null;
  }

  const id = (process.env.DEV_STAFF_ID ?? 'dev-staff').trim() || 'dev-staff';
  const displayName = (process.env.DEV_STAFF_DISPLAY_NAME ?? 'Dev Staff').trim() || 'Dev Staff';
  const roles = parseRoles(process.env.DEV_STAFF_ROLES);
  const enrolled = parseBoolean(process.env.DEV_STAFF_ENROLLED, true);
  const verified = parseBoolean(process.env.DEV_STAFF_VERIFIED, true);
  const status = ((process.env.DEV_STAFF_STATUS ?? 'active').trim() || 'active').toLowerCase();
  const passkeyEnrolled = parseBoolean(process.env.DEV_STAFF_PASSKEY_ENROLLED, true);

  return {
    id,
    email,
    displayName,
    roles,
    enrolled,
    verified,
    status,
    passkeyEnrolled
  };
}
