import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { encrypt, decrypt } from './crypto';
import { logAudit } from './audit';

export type SecretRow = {
  id: string;
  key: string;
  env: string;
  description: string | null;
  ciphertext: string;
  iv: string;
  aad: string | null;
  version: number;
  requires_dual_control: boolean;
  created_by: string;
  created_at: string;
  last_rotated_at: string | null;
  last_accessed_at: string | null;
};

export type SecretChangeRequestRow = {
  id: string;
  key: string;
  env: string;
  action: 'create' | 'rotate' | 'reveal';
  proposed_ciphertext: string | null;
  proposed_iv: string | null;
  proposed_aad: string | null;
  reason: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';
  created_at: string;
  applied_at: string | null;
};

export type SecretChangeApprovalRow = {
  id: string;
  request_id: string;
  approver_user_id: string;
  created_at: string;
};

type HexString = `\\x${string}`;

function toPgBytea(buffer: Buffer): HexString {
  return `\\x${buffer.toString('hex')}`;
}

function fromPgBytea(value: string | null): Buffer {
  if (!value) {
    return Buffer.alloc(0);
  }
  const trimmed = value.startsWith('\\x') ? value.slice(2) : value;
  return Buffer.from(trimmed, 'hex');
}

function normaliseKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('Secret key is required');
  }
  return trimmed;
}

function normaliseEnv(env?: string): string {
  const trimmed = env?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'prod';
}

function normaliseReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error('Reason is required');
  }
  return trimmed.slice(0, 2000);
}

type ProposalOptions = {
  aad?: string | null;
  description?: string | null;
};

export async function proposeCreate(
  key: string,
  env: string,
  plaintext: string,
  reason: string,
  requestedBy: string,
  options?: ProposalOptions
): Promise<string> {
  const normalisedKey = normaliseKey(key);
  const normalisedEnv = normaliseEnv(env);
  const normalisedReason = normaliseReason(reason);
  const aad = options?.aad ?? null;
  const supabase = createSupabaseServiceRoleClient<any>();

  const existing = await (supabase.from('secrets') as any)
    .select('id')
    .eq('key', normalisedKey)
    .eq('env', normalisedEnv)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    console.error('[secrets] failed to check existing secret', existing.error);
    throw new Error('Failed to evaluate existing secret');
  }

  if (existing.data) {
    throw new Error('Secret already exists for this environment');
  }

  const { ciphertext, iv } = encrypt(plaintext, aad ?? undefined);

  const { data, error } = await (supabase.from('secret_change_requests') as any)
    .insert({
      key: normalisedKey,
      env: normalisedEnv,
      action: 'create',
      proposed_ciphertext: toPgBytea(ciphertext),
      proposed_iv: toPgBytea(iv),
      proposed_aad: aad ?? null,
      reason: normalisedReason,
      requested_by: requestedBy
    })
    .select('id')
    .single();

  if (error) {
    console.error('[secrets] failed to create secret request', error);
    throw new Error('Failed to create secret request');
  }

  const requestId = data.id as string;

  try {
    await logAudit({
      action: 'secret.request_created',
      targetType: 'secret',
      targetId: `${normalisedKey}:${normalisedEnv}`,
      meta: { action: 'create' }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for create request', auditError);
  }

  return requestId;
}

export async function proposeRotate(
  key: string,
  env: string,
  plaintext: string,
  reason: string,
  requestedBy: string,
  options?: ProposalOptions
): Promise<string> {
  const normalisedKey = normaliseKey(key);
  const normalisedEnv = normaliseEnv(env);
  const normalisedReason = normaliseReason(reason);
  const aad = options?.aad ?? null;
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data: secretRow, error: secretError } = await (supabase.from('secrets') as any)
    .select('id, version')
    .eq('key', normalisedKey)
    .eq('env', normalisedEnv)
    .maybeSingle();

  if (secretError && secretError.code !== 'PGRST116') {
    console.error('[secrets] failed to load secret for rotation', secretError);
    throw new Error('Failed to load secret for rotation');
  }

  if (!secretRow) {
    throw new Error('Secret not found for rotation');
  }

  const { ciphertext, iv } = encrypt(plaintext, aad ?? undefined);

  const { data, error } = await (supabase.from('secret_change_requests') as any)
    .insert({
      key: normalisedKey,
      env: normalisedEnv,
      action: 'rotate',
      proposed_ciphertext: toPgBytea(ciphertext),
      proposed_iv: toPgBytea(iv),
      proposed_aad: aad ?? null,
      reason: normalisedReason,
      requested_by: requestedBy
    })
    .select('id')
    .single();

  if (error) {
    console.error('[secrets] failed to create rotate request', error);
    throw new Error('Failed to create secret rotation request');
  }

  const requestId = data.id as string;

  try {
    await logAudit({
      action: 'secret.request_created',
      targetType: 'secret',
      targetId: `${normalisedKey}:${normalisedEnv}`,
      meta: { action: 'rotate', current_version: secretRow.version }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for rotate request', auditError);
  }

  return requestId;
}

export async function proposeReveal(
  key: string,
  env: string,
  reason: string,
  requestedBy: string
): Promise<string> {
  const normalisedKey = normaliseKey(key);
  const normalisedEnv = normaliseEnv(env);
  const normalisedReason = normaliseReason(reason);
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data: secretRow, error: secretError } = await (supabase.from('secrets') as any)
    .select('id, version')
    .eq('key', normalisedKey)
    .eq('env', normalisedEnv)
    .maybeSingle();

  if (secretError && secretError.code !== 'PGRST116') {
    console.error('[secrets] failed to load secret for reveal', secretError);
    throw new Error('Failed to load secret for reveal');
  }

  if (!secretRow) {
    throw new Error('Secret not found for reveal');
  }

  const { data, error } = await (supabase.from('secret_change_requests') as any)
    .insert({
      key: normalisedKey,
      env: normalisedEnv,
      action: 'reveal',
      reason: normalisedReason,
      requested_by: requestedBy
    })
    .select('id')
    .single();

  if (error) {
    console.error('[secrets] failed to create reveal request', error);
    throw new Error('Failed to create secret reveal request');
  }

  const requestId = data.id as string;

  try {
    await logAudit({
      action: 'secret.request_created',
      targetType: 'secret',
      targetId: `${normalisedKey}:${normalisedEnv}`,
      meta: { action: 'reveal' }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for reveal request', auditError);
  }

  return requestId;
}

async function recordApproval(
  request: SecretChangeRequestRow,
  approverUserId: string
): Promise<{ approvals: SecretChangeApprovalRow[]; request: SecretChangeRequestRow } | null> {
  const supabase = createSupabaseServiceRoleClient<any>();

  const insertResult = await (supabase.from('secret_change_approvals') as any)
    .insert({ request_id: request.id, approver_user_id: approverUserId })
    .select('id, request_id, approver_user_id, created_at')
    .single();

  if (insertResult.error) {
    if (insertResult.error.code === '23505') {
      return null;
    }
    console.error('[secrets] failed to record approval', insertResult.error);
    throw new Error('Failed to record approval');
  }

  const { data: approvalsData, error: approvalsError } = await (supabase
    .from('secret_change_approvals') as any)
    .select('id, request_id, approver_user_id, created_at')
    .eq('request_id', request.id);

  if (approvalsError) {
    console.error('[secrets] failed to load approvals', approvalsError);
    throw new Error('Failed to load approvals');
  }

  const approvals = (approvalsData as SecretChangeApprovalRow[] | null) ?? [];
  return { approvals, request };
}

async function applyCreate(
  request: SecretChangeRequestRow,
  approvals: SecretChangeApprovalRow[]
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const ciphertext = fromPgBytea(request.proposed_ciphertext);
  const iv = fromPgBytea(request.proposed_iv);

  if (!ciphertext.length || !iv.length) {
    throw new Error('Create request missing ciphertext');
  }

  const insertPayload = {
    key: request.key,
    env: request.env,
    ciphertext: toPgBytea(ciphertext),
    iv: toPgBytea(iv),
    aad: request.proposed_aad,
    created_by: request.requested_by,
    requires_dual_control: true,
    description: null
  };

  const { error: insertError } = await (supabase.from('secrets') as any)
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    console.error('[secrets] failed to apply create request', insertError);
    throw new Error('Failed to apply secret create request');
  }

  const { error: updateRequestError } = await (supabase.from('secret_change_requests') as any)
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', request.id);

  if (updateRequestError) {
    console.error('[secrets] failed to update create request status', updateRequestError);
  }

  try {
    await logAudit({
      action: 'secret.applied',
      targetType: 'secret',
      targetId: `${request.key}:${request.env}`,
      meta: { action: 'create', approvals: approvals.map((approval) => approval.approver_user_id) }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for applied create', auditError);
  }
}

async function applyRotate(
  request: SecretChangeRequestRow,
  approvals: SecretChangeApprovalRow[]
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const ciphertext = fromPgBytea(request.proposed_ciphertext);
  const iv = fromPgBytea(request.proposed_iv);

  if (!ciphertext.length || !iv.length) {
    throw new Error('Rotate request missing ciphertext');
  }

  const { data: currentRow, error: currentError } = await (supabase.from('secrets') as any)
    .select('id, version')
    .eq('key', request.key)
    .eq('env', request.env)
    .maybeSingle();

  if (currentError && currentError.code !== 'PGRST116') {
    console.error('[secrets] failed to load current secret for rotation', currentError);
    throw new Error('Failed to load secret for rotation');
  }

  if (!currentRow) {
    throw new Error('Secret not found during rotation');
  }

  const nextVersion = (currentRow.version as number) + 1;
  const now = new Date().toISOString();

  const { error: updateError } = await (supabase.from('secrets') as any)
    .update({
      ciphertext: toPgBytea(ciphertext),
      iv: toPgBytea(iv),
      aad: request.proposed_aad,
      version: nextVersion,
      last_rotated_at: now
    })
    .eq('id', currentRow.id);

  if (updateError) {
    console.error('[secrets] failed to update secret during rotation', updateError);
    throw new Error('Failed to update secret during rotation');
  }

  const { error: requestUpdateError } = await (supabase.from('secret_change_requests') as any)
    .update({ status: 'applied', applied_at: now })
    .eq('id', request.id);

  if (requestUpdateError) {
    console.error('[secrets] failed to update rotation request status', requestUpdateError);
  }

  try {
    await logAudit({
      action: 'secret.applied',
      targetType: 'secret',
      targetId: `${request.key}:${request.env}`,
      meta: { action: 'rotate', approvals: approvals.map((approval) => approval.approver_user_id), version: nextVersion }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for applied rotation', auditError);
  }
}

async function markRevealApproved(requestId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const now = new Date().toISOString();

  const { error } = await (supabase.from('secret_change_requests') as any)
    .update({ status: 'approved', applied_at: now })
    .eq('id', requestId);

  if (error) {
    console.error('[secrets] failed to mark reveal approved', error);
  }
}

export async function approve(
  requestId: string,
  approverUserId: string
): Promise<{ status: 'pending' | 'approved' | 'applied'; approvals: SecretChangeApprovalRow[] }> {
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data: requestData, error: requestError } = await (supabase.from('secret_change_requests') as any)
    .select(
      'id, key, env, action, proposed_ciphertext, proposed_iv, proposed_aad, reason, requested_by, status, created_at, applied_at'
    )
    .eq('id', requestId)
    .maybeSingle();

  if (requestError && requestError.code !== 'PGRST116') {
    console.error('[secrets] failed to load request for approval', requestError);
    throw new Error('Failed to load request');
  }

  if (!requestData) {
    throw new Error('Secret request not found');
  }

  const requestRow = requestData as SecretChangeRequestRow;

  if (requestRow.requested_by === approverUserId) {
    throw new Error('Requester cannot approve their own request');
  }

  if (requestRow.status !== 'pending') {
    if (requestRow.action === 'reveal' && requestRow.status === 'approved') {
      return { status: 'approved', approvals: [] };
    }
    if (requestRow.status === 'applied') {
      return { status: 'applied', approvals: [] };
    }
    throw new Error('Request is not pending');
  }

  const recorded = await recordApproval(requestRow, approverUserId);
  if (!recorded) {
    throw new Error('Approval already recorded for this user');
  }

  const approvals = recorded.approvals;

  try {
    await logAudit({
      action: 'secret.approved',
      targetType: 'secret',
      targetId: `${requestRow.key}:${requestRow.env}`,
      meta: { action: requestRow.action, approver: approverUserId, approvals: approvals.length }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for approval', auditError);
  }

  if (approvals.length < 2) {
    return { status: 'pending', approvals };
  }

  switch (requestRow.action) {
    case 'create':
      await applyCreate(requestRow, approvals);
      return { status: 'applied', approvals };
    case 'rotate':
      await applyRotate(requestRow, approvals);
      return { status: 'applied', approvals };
    case 'reveal':
      await markRevealApproved(requestRow.id);
      return { status: 'approved', approvals };
    default:
      throw new Error(`Unsupported action ${requestRow.action}`);
  }
}

export async function getDecrypted(
  key: string,
  env?: string,
  options?: { requestId?: string; skipAudit?: boolean; skipTouch?: boolean }
): Promise<string> {
  const normalisedKey = normaliseKey(key);
  const normalisedEnv = normaliseEnv(env);
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data, error } = await (supabase.from('secrets') as any)
    .select('id, ciphertext, iv, aad')
    .eq('key', normalisedKey)
    .eq('env', normalisedEnv)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[secrets] failed to load secret for decryption', error);
    throw new Error('Failed to load secret');
  }

  if (!data) {
    throw new Error('Secret not found');
  }

  const secretRow = data as { id: string; ciphertext: string; iv: string; aad: string | null };
  const plaintext = decrypt(fromPgBytea(secretRow.ciphertext), fromPgBytea(secretRow.iv), secretRow.aad ?? undefined);

  if (!options?.skipTouch) {
    const { error: updateError } = await (supabase.from('secrets') as any)
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', secretRow.id);

    if (updateError) {
      console.warn('[secrets] failed to update last accessed timestamp', updateError);
    }
  }

  if (!options?.skipAudit) {
    try {
      await logAudit({
        action: 'secret.retrieved',
        targetType: 'secret',
        targetId: `${normalisedKey}:${normalisedEnv}`,
        meta: options?.requestId ? { request_id: options.requestId } : undefined
      });
    } catch (auditError) {
      console.warn('[secrets] failed to log audit for retrieval', auditError);
    }
  }

  return plaintext;
}

export function maskSecretTail(value: string, visible = 4): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '••••';
  }
  if (trimmed.length <= visible) {
    return '••••';
  }
  return `••••${trimmed.slice(-visible)}`;
}

export async function loadSecretsSummary(): Promise<
  Array<{
    key: string;
    env: string;
    version: number;
    lastRotatedAt: string | null;
    lastAccessedAt: string | null;
    requiresDualControl: boolean;
  }>
> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('secrets') as any)
    .select('key, env, version, last_rotated_at, last_accessed_at, requires_dual_control')
    .order('key', { ascending: true })
    .order('env', { ascending: true });

  if (error) {
    console.error('[secrets] failed to load secrets summary', error);
    throw new Error('Failed to load secrets');
  }

  const rows = (data as Array<{
    key: string;
    env: string;
    version: number;
    last_rotated_at: string | null;
    last_accessed_at: string | null;
    requires_dual_control: boolean;
  }> | null) ?? [];

  return rows.map((row) => ({
    key: row.key,
    env: row.env,
    version: row.version,
    lastRotatedAt: row.last_rotated_at,
    lastAccessedAt: row.last_accessed_at,
    requiresDualControl: Boolean(row.requires_dual_control)
  }));
}

export async function loadSecretRequests(limit = 50): Promise<
  Array<
    SecretChangeRequestRow & {
      approvals: SecretChangeApprovalRow[];
    }
  >
> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('secret_change_requests') as any)
    .select('id, key, env, action, reason, requested_by, status, created_at, applied_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[secrets] failed to load change requests', error);
    throw new Error('Failed to load secret requests');
  }

  const requests = (data as SecretChangeRequestRow[] | null) ?? [];
  if (!requests.length) {
    return [];
  }

  const requestIds = requests.map((request) => request.id);
  const { data: approvalsData, error: approvalsError } = await (supabase
    .from('secret_change_approvals') as any)
    .select('id, request_id, approver_user_id, created_at')
    .in('request_id', requestIds);

  if (approvalsError) {
    console.error('[secrets] failed to load approvals', approvalsError);
    throw new Error('Failed to load approvals');
  }

  const approvals = (approvalsData as SecretChangeApprovalRow[] | null) ?? [];
  const grouped = new Map<string, SecretChangeApprovalRow[]>();
  for (const approval of approvals) {
    const list = grouped.get(approval.request_id) ?? [];
    list.push(approval);
    grouped.set(approval.request_id, list);
  }

  return requests.map((request) => ({
    ...request,
    approvals: grouped.get(request.id) ?? []
  }));
}

export async function consumeReveal(
  requestId: string,
  requesterUserId: string
): Promise<{ plaintext: string; key: string; env: string } | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('secret_change_requests') as any)
    .select('id, key, env, action, status, applied_at, requested_by')
    .eq('id', requestId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[secrets] failed to load reveal request', error);
    throw new Error('Failed to load reveal request');
  }

  if (!data) {
    return null;
  }

  const request = data as SecretChangeRequestRow;

  if (request.action !== 'reveal' || request.status !== 'approved') {
    return null;
  }

  const approvedAt = request.applied_at ? new Date(request.applied_at) : null;
  if (!approvedAt || Number.isNaN(approvedAt.getTime())) {
    return null;
  }

  const now = Date.now();
  if (now - approvedAt.getTime() > 10 * 60 * 1000) {
    return null;
  }

  const plaintext = await getDecrypted(request.key, request.env, {
    requestId: request.id,
    skipAudit: true
  });

  const { error: updateError } = await (supabase.from('secret_change_requests') as any)
    .update({ status: 'applied' })
    .eq('id', request.id);

  if (updateError) {
    console.error('[secrets] failed to mark reveal as applied', updateError);
  }

  try {
    await logAudit({
      action: 'secret.revealed',
      targetType: 'secret',
      targetId: `${request.key}:${request.env}`,
      meta: { request_id: request.id, requester: requesterUserId }
    });
  } catch (auditError) {
    console.warn('[secrets] failed to log audit for reveal', auditError);
  }

  return { plaintext, key: request.key, env: request.env };
}
