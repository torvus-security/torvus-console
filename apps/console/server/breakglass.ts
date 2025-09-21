import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { logAudit } from './audit';
import { grantTemporaryRoles } from './roles';

type BreakGlassRequestRow = {
  id: string;
  requested_by: string;
  target_user_id: string;
  roles: string[];
  reason: string;
  ticket_url: string | null;
  window_minutes: number;
  status: string;
  executed_at: string | null;
};

function buildAuditMeta(row: Pick<BreakGlassRequestRow, 'roles' | 'window_minutes' | 'reason' | 'ticket_url'>) {
  return {
    roles: row.roles ?? [],
    minutes: row.window_minutes,
    reason: row.reason,
    ticket_url: row.ticket_url ?? null
  };
}

async function auditEvent(action: string, targetUserId: string, meta: Record<string, unknown>) {
  try {
    await logAudit({
      action,
      targetType: 'user',
      targetId: targetUserId,
      meta
    });
  } catch (error) {
    console.info(`[audit] fallback ${action}`, { targetUserId, meta, error });
  }
}

function singleApproverEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.BREAK_GLASS_DEV_SINGLE_APPROVER === '1'
  );
}

export async function createRequest(params: {
  requesterUserId: string;
  targetUserId: string;
  roles: string[];
  reason: string;
  ticketUrl?: string;
  windowMinutes?: number;
}): Promise<{ id: string }> {
  const { requesterUserId, targetUserId, roles, reason, ticketUrl, windowMinutes } = params;
  if (!requesterUserId?.trim()) {
    throw new Error('Requester user id is required');
  }
  if (!targetUserId?.trim()) {
    throw new Error('Target user id is required');
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error('At least one role must be requested');
  }
  if (!reason?.trim()) {
    throw new Error('Reason is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const roleList = Array.from(new Set(roles.map((role) => role?.trim()).filter(Boolean)));
  if (roleList.length === 0) {
    throw new Error('Role names were empty after normalisation');
  }

  const insertPayload: Record<string, unknown> = {
    requested_by: requesterUserId,
    target_user_id: targetUserId,
    roles: roleList,
    reason,
    ticket_url: ticketUrl ?? null
  };

  if (windowMinutes && windowMinutes > 0) {
    insertPayload.window_minutes = windowMinutes;
  }

  const { data, error } = await (supabase.from('elevation_requests') as any)
    .insert(insertPayload)
    .select('id, target_user_id, roles, window_minutes, reason, ticket_url')
    .single();

  if (error) {
    throw new Error(`Failed to create elevation request: ${error.message ?? 'unknown error'}`);
  }

  const row = data as Pick<BreakGlassRequestRow, 'id' | 'target_user_id' | 'roles' | 'window_minutes' | 'reason' | 'ticket_url'>;
  await auditEvent('elevation.requested', row.target_user_id, buildAuditMeta(row));
  return { id: row.id };
}

export async function approveRequest(params: {
  requestId: string;
  approverUserId: string;
}): Promise<{ approvals: number; executed: boolean }> {
  const { requestId, approverUserId } = params;
  if (!requestId?.trim()) {
    throw new Error('Request id is required');
  }
  if (!approverUserId?.trim()) {
    throw new Error('Approver user id is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const { data: requestData, error: requestError } = await (supabase
    .from('elevation_requests') as any)
    .select('id, requested_by, target_user_id, status, roles, window_minutes, reason, ticket_url, executed_at')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`Failed to load request: ${requestError.message ?? 'unknown error'}`);
  }

  const request = requestData as BreakGlassRequestRow | null;
  if (!request) {
    throw new Error('Elevation request not found');
  }

  if (request.requested_by === approverUserId) {
    throw new Error('Requesters may not approve their own elevation');
  }

  if (['rejected', 'revoked', 'expired'].includes(request.status)) {
    throw new Error(`Cannot approve request in status ${request.status}`);
  }

  const { error: insertError } = await (supabase.from('elevation_approvals') as any).insert({
    request_id: requestId,
    approver_user_id: approverUserId
  });

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      throw new Error('Approval already recorded for this approver');
    }
    throw new Error(`Failed to record approval: ${insertError.message ?? 'unknown error'}`);
  }

  await auditEvent('elevation.approved', request.target_user_id, buildAuditMeta(request));

  const { count } = await (supabase.from('elevation_approvals') as any)
    .select('approver_user_id', { count: 'exact', head: true })
    .eq('request_id', requestId);

  const executed = await maybeExecute(requestId);

  return { approvals: count ?? 0, executed };
}

export async function maybeExecute(requestId: string): Promise<boolean> {
  if (!requestId?.trim()) {
    throw new Error('Request id is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const { data: requestData, error: requestError } = await (supabase
    .from('elevation_requests') as any)
    .select('id, requested_by, target_user_id, roles, window_minutes, status, reason, ticket_url, executed_at')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`Failed to load elevation request: ${requestError.message ?? 'unknown error'}`);
  }

  const request = requestData as BreakGlassRequestRow | null;
  if (!request) {
    return false;
  }

  if (request.status === 'executed') {
    return true;
  }

  if (['rejected', 'revoked', 'expired'].includes(request.status)) {
    return false;
  }

  const { data: approvalRows, error: approvalsError } = await (supabase
    .from('elevation_approvals') as any)
    .select('approver_user_id')
    .eq('request_id', requestId);

  if (approvalsError) {
    throw new Error(`Failed to load approvals: ${approvalsError.message ?? 'unknown error'}`);
  }

  const approvals = new Set<string>();
  for (const row of (approvalRows as Array<{ approver_user_id: string }> | null) ?? []) {
    if (row.approver_user_id && row.approver_user_id !== request.requested_by) {
      approvals.add(row.approver_user_id);
    }
  }

  const requiredApprovals = singleApproverEnabled() ? 1 : 2;
  if (approvals.size < requiredApprovals) {
    return false;
  }

  if (request.status === 'pending') {
    await (supabase.from('elevation_requests') as any)
      .update({ status: 'approved' })
      .eq('id', requestId)
      .eq('status', 'pending');
  }

  const executedAt = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await (supabase
    .from('elevation_requests') as any)
    .update({ status: 'executed', executed_at: executedAt })
    .eq('id', requestId)
    .in('status', ['approved', 'pending'])
    .is('executed_at', null)
    .select('target_user_id, roles, window_minutes, reason, ticket_url');

  if (updateError) {
    throw new Error(`Failed to mark request executed: ${updateError.message ?? 'unknown error'}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: refreshed } = await (supabase
      .from('elevation_requests') as any)
      .select('status')
      .eq('id', requestId)
      .maybeSingle();

    return (refreshed as { status?: string } | null)?.status === 'executed';
  }

  const updated = updatedRows[0] as Pick<BreakGlassRequestRow, 'target_user_id' | 'roles' | 'window_minutes' | 'reason' | 'ticket_url'>;

  try {
    await grantTemporaryRoles({
      targetUserId: updated.target_user_id,
      roleNames: updated.roles ?? [],
      minutes: updated.window_minutes,
      justification: updated.reason,
      ticketUrl: updated.ticket_url ?? undefined
    });
  } catch (error) {
    await (supabase.from('elevation_requests') as any)
      .update({ status: 'approved', executed_at: null })
      .eq('id', requestId)
      .eq('status', 'executed');
    throw error;
  }

  await auditEvent('elevation.executed', updated.target_user_id, buildAuditMeta(updated));
  return true;
}

export async function revokeRequest(params: {
  requestId: string;
  byUserId: string;
}): Promise<{ revoked: boolean }> {
  const { requestId, byUserId } = params;
  if (!requestId?.trim()) {
    throw new Error('Request id is required');
  }
  if (!byUserId?.trim()) {
    throw new Error('Revoker user id is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const { data: requestData, error: requestError } = await (supabase
    .from('elevation_requests') as any)
    .select('id, target_user_id, roles, window_minutes, reason, ticket_url, status')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`Failed to load request: ${requestError.message ?? 'unknown error'}`);
  }

  const request = requestData as (Pick<BreakGlassRequestRow, 'id' | 'target_user_id' | 'roles' | 'window_minutes' | 'reason' | 'ticket_url' | 'status'>) | null;
  if (!request) {
    return { revoked: false };
  }

  if (request.status === 'revoked') {
    return { revoked: false };
  }

  const { data: updatedRows, error: updateError } = await (supabase
    .from('elevation_requests') as any)
    .update({ status: 'revoked' })
    .eq('id', requestId)
    .neq('status', 'revoked')
    .select('target_user_id, roles, window_minutes, reason, ticket_url');

  if (updateError) {
    throw new Error(`Failed to revoke request: ${updateError.message ?? 'unknown error'}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { revoked: false };
  }

  const updated = updatedRows[0] as Pick<BreakGlassRequestRow, 'target_user_id' | 'roles' | 'window_minutes' | 'reason' | 'ticket_url'>;
  await auditEvent('elevation.revoked', updated.target_user_id, buildAuditMeta(updated));
  return { revoked: true };
}
