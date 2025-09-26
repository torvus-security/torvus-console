'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminStaff } from '../../../../../lib/auth';
import {
  PLAN_KEYS,
  CAPABILITY_KEYS,
  type PlanKey,
  type CapabilityKey,
  setPlan,
  grantCapability,
  revokeCapability,
  triggerArchive,
  triggerRestore
} from '../../../../../server/entitlements';

const PLAN_KEY_SET = new Set(PLAN_KEYS);
const CAPABILITY_KEY_SET = new Set(CAPABILITY_KEYS);

export type EntitlementActionResult = {
  success: boolean;
  message: string;
};

type UpdatePlanInput = {
  userId: string;
  planKey: string;
};

type CapabilityInput = {
  userId: string;
  capability: string;
  enable: boolean;
};

type TargetInput = {
  userId: string;
};

function normalizeUserId(userId: string): string | null {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  return trimmed.length ? trimmed : null;
}

function success(message: string): EntitlementActionResult {
  return { success: true, message };
}

function failure(message: string): EntitlementActionResult {
  return { success: false, message };
}

export async function updatePlanAction(input: UpdatePlanInput): Promise<EntitlementActionResult> {
  const userId = normalizeUserId(input.userId);
  if (!userId) {
    return failure('Missing user identifier.');
  }

  if (!PLAN_KEY_SET.has(input.planKey as PlanKey)) {
    return failure('Unsupported plan selection.');
  }

  const planKey = input.planKey as PlanKey;

  try {
    const staffUser = await requireAdminStaff();
    await setPlan(userId, planKey, staffUser.id);
    revalidatePath(`/users/${userId}/entitlements`);
    return success(`Plan updated to ${planKey}.`);
  } catch (error) {
    console.error('[entitlements] failed to update plan', { userId, planKey, error });
    const message = error instanceof Error ? error.message : 'Failed to update plan.';
    return failure(message);
  }
}

export async function updateCapabilityAction(input: CapabilityInput): Promise<EntitlementActionResult> {
  const userId = normalizeUserId(input.userId);
  if (!userId) {
    return failure('Missing user identifier.');
  }

  if (!CAPABILITY_KEY_SET.has(input.capability as CapabilityKey)) {
    return failure('Unsupported capability.');
  }

  const capability = input.capability as CapabilityKey;

  try {
    const staffUser = await requireAdminStaff();

    if (input.enable) {
      await grantCapability(userId, capability, staffUser.id);
      revalidatePath(`/users/${userId}/entitlements`);
      return success(`Granted ${capability} capability.`);
    }

    await revokeCapability(userId, capability);
    revalidatePath(`/users/${userId}/entitlements`);
    return success(`Revoked ${capability} capability.`);
  } catch (error) {
    console.error('[entitlements] failed to toggle capability', {
      userId,
      capability,
      enable: input.enable,
      error
    });
    const message = error instanceof Error ? error.message : 'Failed to update capability.';
    return failure(message);
  }
}

export async function archiveJournalistAction(input: TargetInput): Promise<EntitlementActionResult> {
  const userId = normalizeUserId(input.userId);
  if (!userId) {
    return failure('Missing user identifier.');
  }

  try {
    const staffUser = await requireAdminStaff();
    await triggerArchive(userId, staffUser.id);
    revalidatePath(`/users/${userId}/entitlements`);
    return success('Journalist access disabled and cases archived.');
  } catch (error) {
    console.error('[entitlements] failed to archive journalist access', { userId, error });
    const message = error instanceof Error ? error.message : 'Failed to archive journalist access.';
    return failure(message);
  }
}

export async function restoreJournalistAction(input: TargetInput): Promise<EntitlementActionResult> {
  const userId = normalizeUserId(input.userId);
  if (!userId) {
    return failure('Missing user identifier.');
  }

  try {
    const staffUser = await requireAdminStaff();
    await triggerRestore(userId, staffUser.id);
    revalidatePath(`/users/${userId}/entitlements`);
    return success('Journalist access restored.');
  } catch (error) {
    console.error('[entitlements] failed to restore journalist access', { userId, error });
    const message = error instanceof Error ? error.message : 'Failed to restore journalist access.';
    return failure(message);
  }
}
