import type { IntakeIntegrationKind, IntakeIntegrationRow } from '../../../../../server/intake';

export const ALLOWED_INTAKE_KINDS: IntakeIntegrationKind[] = ['generic', 'statuspage', 'sentry', 'posthog'];

export function normaliseKind(value: unknown): IntakeIntegrationKind | null {
  if (typeof value !== 'string') {
    return null;
  }
  const lower = value.trim().toLowerCase();
  return ALLOWED_INTAKE_KINDS.includes(lower as IntakeIntegrationKind)
    ? (lower as IntakeIntegrationKind)
    : null;
}

export function normaliseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export function normaliseSecret(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length >= 8 ? trimmed : null;
}

export function maskSecret(secretHash: string): string {
  const hex = secretHash.startsWith('\\x') ? secretHash.slice(2) : secretHash;
  const tail = hex.slice(-6);
  return `••••${tail}`;
}

export function serialiseIntegration(row: IntakeIntegrationRow, count: number) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    maskedSecret: maskSecret(row.secret_hash),
    eventCount: count
  };
}
