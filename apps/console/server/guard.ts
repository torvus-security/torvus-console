import type { NextRequest } from 'next/server';
import { getReadOnly, type ReadOnlySettings } from './settings';

export class ReadOnlyModeError extends Error {
  readonly status: number;
  readonly settings: ReadOnlySettings;
  readonly routeId: string;

  constructor(message: string, settings: ReadOnlySettings, routeId: string) {
    super(message);
    this.name = 'ReadOnlyModeError';
    this.status = 503;
    this.settings = settings;
    this.routeId = routeId;
  }
}

export function isReadOnlyError(error: unknown): error is ReadOnlyModeError {
  return error instanceof ReadOnlyModeError;
}

function normaliseRoles(roles: string[] | null | undefined): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }

  const unique = new Set<string>();
  for (const role of roles) {
    if (typeof role !== 'string') {
      continue;
    }
    const trimmed = role.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed.toLowerCase());
  }

  return Array.from(unique);
}

function hasAllowedRole(requesterRoles: string[], allowedRoles: string[]): boolean {
  if (!allowedRoles.length) {
    return false;
  }

  const allowed = new Set(allowedRoles.map((role) => role.toLowerCase()));
  return requesterRoles.some((role) => allowed.has(role));
}

export function toReadOnlyResponse(error: ReadOnlyModeError, format: 'json' | 'text' = 'text'): Response {
  if (format === 'json') {
    const payload = {
      error: 'read_only',
      message: error.message,
      allow_roles: error.settings.allow_roles
    };
    return new Response(JSON.stringify(payload), {
      status: error.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(error.message, {
    status: error.status,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}

export async function enforceNotReadOnly(
  request: Request | NextRequest | null,
  roles: string[],
  routeId: string
): Promise<void> {
  const settings = await getReadOnly();
  if (!settings.enabled) {
    return;
  }

  const requesterRoles = normaliseRoles(roles);
  if (hasAllowedRole(requesterRoles, settings.allow_roles)) {
    return;
  }

  const details = {
    routeId,
    method: request?.method ?? 'server-action',
    url: request ? request.url : undefined,
    roles: requesterRoles
  };

  console.warn('[read-only] blocked mutation', details);
  throw new ReadOnlyModeError(settings.message, settings, routeId);
}
