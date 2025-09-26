import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { logAudit } from './audit';

const PLAN_KEY_VALUES = ['free', 'standard', 'journalist'] as const;
export type PlanKey = (typeof PLAN_KEY_VALUES)[number];

const CAPABILITY_KEY_VALUES = ['journalist'] as const;
export type CapabilityKey = (typeof CAPABILITY_KEY_VALUES)[number];

export type UserRecord = {
  user_id: string;
  email: string;
  full_name: string | null;
};

export type PlanRecord = {
  plan_key: PlanKey | string;
  set_by: string | null;
  set_at: string | null;
};

export type CapabilityGrant = {
  capability: CapabilityKey | string;
  granted_by: string | null;
  granted_at: string | null;
};

export type EntitlementsSnapshot = {
  plan: PlanRecord | null;
  grants: CapabilityGrant[];
};

type PlanRow = {
  plan_key: string | null;
  set_by: string | null;
  set_at: string | null;
} | null;

type CapabilityRow = {
  capability_key: string | null;
  granted_by: string | null;
  granted_at: string | null;
} | null;

function getClient(client?: SupabaseClient<any>): SupabaseClient<any> {
  return client ?? createSupabaseServiceRoleClient<any>();
}

function normaliseEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normaliseKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && PLAN_KEY_VALUES.includes(value as PlanKey);
}

function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === 'string' && CAPABILITY_KEY_VALUES.includes(value as CapabilityKey);
}

type AdminUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> & { full_name?: unknown };
};

type AdminResponse = {
  data: { user: AdminUser | null } | null;
  error: { message?: string; status?: number } | null;
};

function toUserRecord(user: AdminUser | null): UserRecord | null {
  if (!user?.id) {
    return null;
  }
  const email = normaliseEmail(user.email);
  if (!email) {
    return null;
  }
  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;
  return {
    user_id: user.id,
    email,
    full_name: fullName
  };
}

export async function getUserByEmail(email: string, client?: SupabaseClient<any>): Promise<UserRecord | null> {
  const normalisedEmail = normaliseEmail(email);
  if (!normalisedEmail) {
    return null;
  }

  const supabase = getClient(client);
  const response = (await supabase.auth.admin.getUserByEmail(normalisedEmail)) as AdminResponse;

  if (response.error) {
    if (response.error.status === 404) {
      return null;
    }
    throw new Error(response.error.message ?? 'Failed to resolve user by email');
  }

  return toUserRecord(response.data?.user ?? null);
}

export async function getUserById(userId: string, client?: SupabaseClient<any>): Promise<UserRecord | null> {
  const trimmed = userId?.trim();
  if (!trimmed) {
    return null;
  }

  const supabase = getClient(client);
  const response = (await supabase.auth.admin.getUserById(trimmed)) as AdminResponse;

  if (response.error) {
    if (response.error.status === 404) {
      return null;
    }
    throw new Error(response.error.message ?? 'Failed to resolve user by id');
  }

  return toUserRecord(response.data?.user ?? null);
}

export async function getPlan(userId: string, client?: SupabaseClient<any>): Promise<PlanRecord | null> {
  const trimmed = userId?.trim();
  if (!trimmed) {
    return null;
  }

  const supabase = getClient(client);
  const { data, error } = (await (supabase.from('user_plans') as any)
    .select('plan_key,set_by,set_at')
    .eq('user_id', trimmed)
    .maybeSingle()) as { data: PlanRow; error: { message?: string; code?: string } | null };

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message ?? 'Failed to load user plan');
  }

  if (!data?.plan_key) {
    return null;
  }

  return {
    plan_key: isPlanKey(data.plan_key) ? (data.plan_key as PlanKey) : data.plan_key,
    set_by: data.set_by ?? null,
    set_at: data.set_at ?? null
  };
}

export async function getCapabilityGrants(
  userId: string,
  client?: SupabaseClient<any>
): Promise<CapabilityGrant[]> {
  const trimmed = userId?.trim();
  if (!trimmed) {
    return [];
  }

  const supabase = getClient(client);
  const { data, error } = (await (supabase.from('user_capabilities') as any)
    .select('capability_key,granted_by,granted_at')
    .eq('user_id', trimmed)) as { data: CapabilityRow[] | null; error: { message?: string } | null };

  if (error) {
    throw new Error(error.message ?? 'Failed to load capability grants');
  }

  const rows = (data ?? []).filter((row): row is NonNullable<CapabilityRow> => Boolean(row));

  return rows
    .map((row) => {
      const capability = normaliseKey(row.capability_key);
      if (!capability) {
        return null;
      }
      return {
        capability,
        granted_by: row.granted_by ?? null,
        granted_at: row.granted_at ?? null
      } as CapabilityGrant;
    })
    .filter((grant): grant is CapabilityGrant => Boolean(grant));
}

export async function getEntitlements(userId: string, client?: SupabaseClient<any>): Promise<EntitlementsSnapshot> {
  const supabase = getClient(client);
  const [plan, grants] = await Promise.all([getPlan(userId, supabase), getCapabilityGrants(userId, supabase)]);
  return { plan, grants };
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

export async function setPlan(
  userId: string,
  planKey: PlanKey,
  staffId: string | null,
  client?: SupabaseClient<any>
): Promise<boolean> {
  const supabase = getClient(client);
  const previous = await getPlan(userId, supabase);
  const payload = {
    user_id: userId,
    plan_key: planKey,
    set_by: staffId ?? null,
    set_at: currentTimestamp()
  };

  const { error } = await (supabase.from('user_plans') as any).upsert(payload, { onConflict: 'user_id' });

  if (error) {
    throw new Error(error.message ?? 'Failed to update user plan');
  }

  const changed = previous?.plan_key !== planKey;

  if (changed) {
    await logAudit({
      action: 'plan.updated',
      targetType: 'user.entitlements',
      targetId: userId,
      meta: {
        plan_key: planKey,
        previous_plan_key: previous?.plan_key ?? null
      }
    });
  }

  return changed;
}

export async function grantCapability(
  userId: string,
  capability: CapabilityKey,
  staffId: string | null,
  client?: SupabaseClient<any>
): Promise<boolean> {
  if (!isCapabilityKey(capability)) {
    throw new Error(`Unsupported capability: ${capability}`);
  }

  const supabase = getClient(client);
  const grants = await getCapabilityGrants(userId, supabase);
  const alreadyGranted = grants.some((grant) => grant.capability === capability);

  if (alreadyGranted) {
    const { error } = await (supabase.from('user_capabilities') as any)
      .update({ granted_by: staffId ?? null, granted_at: currentTimestamp() })
      .eq('user_id', userId)
      .eq('capability_key', capability);

    if (error) {
      throw new Error(error.message ?? 'Failed to refresh capability grant');
    }

    return false;
  }

  const { error } = await (supabase.from('user_capabilities') as any).insert({
    user_id: userId,
    capability_key: capability,
    granted_by: staffId ?? null,
    granted_at: currentTimestamp()
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to grant capability');
  }

  await logAudit({
    action: 'capability.updated',
    targetType: 'user.entitlements',
    targetId: userId,
    meta: {
      capability,
      op: 'grant'
    }
  });

  return true;
}

export async function revokeCapability(
  userId: string,
  capability: CapabilityKey,
  client?: SupabaseClient<any>
): Promise<boolean> {
  if (!isCapabilityKey(capability)) {
    throw new Error(`Unsupported capability: ${capability}`);
  }

  const supabase = getClient(client);
  const { data, error } = (await (supabase.from('user_capabilities') as any)
    .delete()
    .eq('user_id', userId)
    .eq('capability_key', capability)
    .select('capability_key')
    .maybeSingle()) as { data: { capability_key: string } | null; error: { message?: string; code?: string } | null };

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message ?? 'Failed to revoke capability');
  }

  const removed = Boolean(data?.capability_key);

  if (removed) {
    await logAudit({
      action: 'capability.updated',
      targetType: 'user.entitlements',
      targetId: userId,
      meta: {
        capability,
        op: 'revoke'
      }
    });
  }

  return removed;
}

async function invokeArchiveRpc(userId: string, client?: SupabaseClient<any>) {
  const supabase = getClient(client);
  const { error } = await supabase.rpc('archive_cases_for_user', { p_user_id: userId });
  if (error) {
    throw new Error(error.message ?? 'Failed to archive cases for user');
  }
}

async function invokeRestoreRpc(userId: string, client?: SupabaseClient<any>) {
  const supabase = getClient(client);
  const { error } = await supabase.rpc('unarchive_cases_for_user', { p_user_id: userId });
  if (error) {
    throw new Error(error.message ?? 'Failed to restore cases for user');
  }
}

export async function triggerArchive(
  userId: string,
  staffId: string | null,
  client?: SupabaseClient<any>
): Promise<void> {
  const supabase = getClient(client);
  await setPlan(userId, 'standard', staffId, supabase);
  await revokeCapability(userId, 'journalist', supabase);
  await invokeArchiveRpc(userId, supabase);
  await logAudit({
    action: 'journalist.archive_all',
    targetType: 'user.entitlements',
    targetId: userId,
    meta: { plan_key: 'standard' }
  });
}

export async function triggerRestore(
  userId: string,
  staffId: string | null,
  client?: SupabaseClient<any>
): Promise<void> {
  const supabase = getClient(client);
  await setPlan(userId, 'journalist', staffId, supabase);
  await invokeRestoreRpc(userId, supabase);
  await logAudit({
    action: 'journalist.restore_all',
    targetType: 'user.entitlements',
    targetId: userId,
    meta: { plan_key: 'journalist' }
  });
}

export const PLAN_KEYS: PlanKey[] = [...PLAN_KEY_VALUES];
export const CAPABILITY_KEYS: CapabilityKey[] = [...CAPABILITY_KEY_VALUES];
