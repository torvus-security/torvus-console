import type { SupabaseClient } from '@supabase/supabase-js';
import { getIdentityFromRequestHeaders, getUserRolesByEmail } from '../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase/admin';

export type AdminContext = {
  supabase: SupabaseClient<any>;
  email: string;
  roles: string[];
};

export async function requireSecurityAdmin(
  request: Request
): Promise<{ ok: true; context: AdminContext } | { ok: false; response: Response }> {
  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return { ok: false, response: new Response('unauthorized', { status: 401 }) };
  }

  const supabase = createSupabaseServiceRoleClient<any>();

  let roles: string[];
  try {
    roles = await getUserRolesByEmail(email, supabase);
  } catch (error) {
    console.error('[admin][integrations] failed to resolve roles', error);
    return { ok: false, response: new Response('failed to resolve roles', { status: 500 }) };
  }

  const hasSecurityAdmin = roles.some((role) => role.toLowerCase() === 'security_admin');
  if (!hasSecurityAdmin) {
    return { ok: false, response: new Response('forbidden', { status: 403 }) };
  }

  return { ok: true, context: { supabase, email, roles } };
}

function maskSecretReference(reference: string): string {
  const trimmed = reference.trim();
  if (!trimmed) {
    return 'secret://••••';
  }
  const visible = trimmed.slice(-8);
  return `secret://…${visible}`;
}

export function maskWebhookUrl(url: string, secretKey?: string | null): string {
  if (secretKey && secretKey.trim()) {
    return maskSecretReference(secretKey);
  }

  if (url.startsWith('secret://')) {
    return maskSecretReference(url.slice('secret://'.length));
  }

  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.replace(/\/$/, '');
    const visibleTail = tail ? tail.slice(-8) : '';
    const displayTail = visibleTail ? `…${visibleTail}` : '…';
    return `${parsed.host}${displayTail}`;
  } catch {
    const trimmed = url.trim();
    if (!trimmed) {
      return 'unknown';
    }
    return trimmed.length > 12 ? `…${trimmed.slice(-8)}` : trimmed;
  }
}

export function normaliseDescription(description: unknown): string | null {
  if (typeof description !== 'string') {
    return null;
  }
  const trimmed = description.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export function normaliseKind(input: unknown): 'slack' | 'teams' | null {
  if (typeof input !== 'string') {
    return null;
  }
  const value = input.trim().toLowerCase();
  return value === 'slack' || value === 'teams' ? value : null;
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
