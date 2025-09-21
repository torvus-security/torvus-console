import { createHash, randomBytes } from 'crypto';
import { createSupabaseServiceRoleClient } from '../lib/supabase';

const TOKEN_PREFIX = 'torv_pat_';
const TOKEN_BYTE_LENGTH = 32;

export type PersonalAccessTokenRow = {
  id: string;
  user_id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
};

function normaliseScopes(scopes: string[] | null | undefined): string[] {
  if (!scopes || scopes.length === 0) {
    return ['read', 'write'];
  }

  const allowedScopes = new Set(['read', 'write']);
  const filtered = scopes
    .map((scope) => scope.trim())
    .filter((scope) => allowedScopes.has(scope));

  return filtered.length > 0 ? Array.from(new Set(filtered)) : ['read', 'write'];
}

function hashToken(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex');
  return `\\x${digest}`;
}

export async function createPat(
  userId: string,
  name: string,
  scopes?: string[],
  expiresAt?: Date | null
): Promise<{ token: string; row: PersonalAccessTokenRow }> {
  const supabase = createSupabaseServiceRoleClient();
  const tokenBytes = randomBytes(TOKEN_BYTE_LENGTH);
  const tokenSecret = `${TOKEN_PREFIX}${tokenBytes.toString('base64url')}`;
  const tokenHash = hashToken(tokenSecret);
  const payload: Record<string, unknown> = {
    user_id: userId,
    name,
    token_hash: tokenHash,
    scopes: normaliseScopes(scopes)
  };

  if (expiresAt) {
    payload.expires_at = expiresAt.toISOString();
  }

  const { data, error } = await (supabase.from('personal_access_tokens') as any)
    .insert(payload)
    .select('id, user_id, name, scopes, created_at, last_used_at, expires_at, revoked')
    .single();

  if (error) {
    console.error('failed to create personal access token', error);
    throw error;
  }

  const row = data as PersonalAccessTokenRow;

  return { token: tokenSecret, row };
}

export async function listPats(userId: string): Promise<PersonalAccessTokenRow[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await (supabase.from('personal_access_tokens') as any)
    .select('id, user_id, name, scopes, created_at, last_used_at, expires_at, revoked')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('failed to list personal access tokens', error);
    throw error;
  }

  return ((data as PersonalAccessTokenRow[] | null) ?? []).map((row) => ({
    ...row,
    scopes: normaliseScopes(row.scopes)
  }));
}

export async function revokePat(id: string, userId: string): Promise<PersonalAccessTokenRow | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await (supabase.from('personal_access_tokens') as any)
    .update({ revoked: true })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('revoked', false)
    .select('id, user_id, name, scopes, created_at, last_used_at, expires_at, revoked')
    .maybeSingle();

  if (error) {
    console.error('failed to revoke personal access token', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as PersonalAccessTokenRow;
  return {
    ...row,
    scopes: normaliseScopes(row.scopes)
  };
}

export async function touchPatUsage(id: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await (supabase.from('personal_access_tokens') as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('failed to update personal access token usage', error);
    throw error;
  }
}
