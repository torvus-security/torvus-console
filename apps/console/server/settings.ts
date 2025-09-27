import { createSupabaseServiceRoleClient } from '../lib/supabase/admin';

export type ReadOnlySettings = {
  enabled: boolean;
  message: string;
  allow_roles: string[];
};

const DEFAULT_SETTINGS: ReadOnlySettings = {
  enabled: false,
  message: 'Maintenance in progress',
  allow_roles: ['security_admin']
};

function normaliseRoles(input: string[] | null | undefined): string[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_SETTINGS.allow_roles];
  }

  const seen = new Set<string>();
  for (const role of input) {
    if (typeof role !== 'string') {
      continue;
    }
    const trimmed = role.trim();
    if (!trimmed) {
      continue;
    }
    seen.add(trimmed);
  }

  if (![...seen].some((role) => role.toLowerCase() === 'security_admin')) {
    seen.add('security_admin');
  }

  return Array.from(seen);
}

function normaliseMessage(message: string | null | undefined): string {
  if (typeof message !== 'string') {
    return DEFAULT_SETTINGS.message;
  }
  const trimmed = message.trim();
  if (!trimmed) {
    return DEFAULT_SETTINGS.message;
  }
  const flattened = trimmed.replace(/\s+/g, ' ').trim();
  return flattened || DEFAULT_SETTINGS.message;
}

export async function getReadOnly(): Promise<ReadOnlySettings> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('app_settings') as any)
    .select('value')
    .eq('key', 'read_only')
    .maybeSingle();

  if (error) {
    console.error('[read-only] failed to load settings', error);
    throw new Error('Unable to load read-only settings');
  }

  const value = (data as { value: unknown } | null)?.value;
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const parsed = value as Partial<ReadOnlySettings>;
  return {
    enabled: Boolean(parsed.enabled),
    message: normaliseMessage(parsed.message),
    allow_roles: normaliseRoles(parsed.allow_roles)
  } satisfies ReadOnlySettings;
}

export async function setReadOnly(
  enabled: boolean,
  message: string,
  allow_roles?: string[],
  updatedBy?: string | null
): Promise<ReadOnlySettings> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const current = allow_roles ? null : await getReadOnly();
  const normalisedRoles = normaliseRoles(allow_roles ?? current?.allow_roles ?? DEFAULT_SETTINGS.allow_roles);
  const normalisedMessage = normaliseMessage(message);

  const value: ReadOnlySettings = {
    enabled,
    message: normalisedMessage,
    allow_roles: normalisedRoles
  };

  const payload = {
    key: 'read_only',
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy ?? null
  };

  const { error } = await (supabase.from('app_settings') as any)
    .upsert(payload, { onConflict: 'key' });

  if (error) {
    console.error('[read-only] failed to persist settings', error);
    throw new Error('Unable to update read-only settings');
  }

  return value;
}
