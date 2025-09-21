import { NextResponse } from 'next/server';
import {
  fetchReleaseDetail,
  hasSecurityAdminRole,
  loadStaffSummaries,
  resolveViewer,
  type ReleaseApprovalRow,
  type StaffSummary
} from '../../utils';
import { sendEvent } from '../../../../../server/notify';

export const dynamic = 'force-dynamic';

function normaliseId(segment: string | string[] | undefined): string | null {
  if (typeof segment !== 'string') {
    return null;
  }
  return segment.trim() || null;
}

export async function POST(request: Request, context: { params?: { id?: string | string[] } }) {
  const id = normaliseId(context.params?.id);
  if (!id) {
    return new Response('invalid id', { status: 400 });
  }

  const viewer = await resolveViewer(request);
  if (viewer.type === 'error') {
    return viewer.response;
  }

  const { supabase, roles, staff } = viewer;

  if (!staff) {
    return new Response('forbidden', { status: 403 });
  }

  if (!hasSecurityAdminRole(roles)) {
    return new Response('forbidden', { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const payload = body as { decision?: unknown; reason?: unknown };
  const decision = payload.decision === 'approve' || payload.decision === 'reject' ? payload.decision : null;
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : undefined;

  if (!decision) {
    return new Response('invalid decision', { status: 400 });
  }

  let detail;
  try {
    detail = await fetchReleaseDetail(supabase, id);
  } catch (error) {
    console.error('Failed to load release detail', error);
    return new Response('failed to load release detail', { status: 500 });
  }

  const requestRow = detail.request;

  if (!requestRow) {
    return new Response('not found', { status: 404 });
  }

  if (requestRow.status !== 'pending') {
    return new Response('request already decided', { status: 409 });
  }

  if (requestRow.requested_by === staff.user_id) {
    return new Response('forbidden', { status: 403 });
  }

  const existingDecision = detail.approvals.some((approval) => approval.approver_id === staff.user_id);
  if (existingDecision) {
    return new Response('decision already recorded', { status: 409 });
  }

  const insertPayload = {
    request_id: id,
    approver_id: staff.user_id,
    decision,
    reason: reason ? reason : null
  };

  const { error: insertError } = await (supabase.from('release_approvals') as any)
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return new Response('duplicate decision', { status: 409 });
    }
    console.error('Failed to record decision', insertError);
    return new Response('failed to record decision', { status: 500 });
  }

  let refreshedDetail;
  let triggeredEvent: 'release.approved' | 'release.rejected' | null = null;
  try {
    refreshedDetail = await fetchReleaseDetail(supabase, id);
  } catch (error) {
    console.error('Failed to refresh release detail', error);
    return new Response('failed to refresh release detail', { status: 500 });
  }

  const updatedRequest = refreshedDetail.request;

  if (!updatedRequest) {
    return new Response('release request missing', { status: 500 });
  }

  const approveCount = Number(updatedRequest.approve_count ?? 0);
  const rejectCount = Number(updatedRequest.reject_count ?? 0);
  let nextStatus = updatedRequest.status;

  if (rejectCount >= 1) {
    nextStatus = 'rejected';
  } else if (approveCount >= 2) {
    nextStatus = 'approved';
  }

  if (nextStatus !== updatedRequest.status) {
    const { error: updateError } = await (supabase.from('release_requests') as any)
      .update({ status: nextStatus, last_decision_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update release request status', updateError);
      return new Response('failed to update release request', { status: 500 });
    }

    try {
      refreshedDetail = await fetchReleaseDetail(supabase, id);
    } catch (error) {
      console.error('Failed to reload release detail', error);
      return new Response('failed to reload release detail', { status: 500 });
    }

    if (nextStatus === 'approved') {
      triggeredEvent = 'release.approved';
    } else if (nextStatus === 'rejected') {
      triggeredEvent = 'release.rejected';
    }
  }

  const finalDetail = refreshedDetail;
  const approvals = finalDetail.approvals as ReleaseApprovalRow[];

  let staffSummaries: Map<string, StaffSummary>;
  try {
    staffSummaries = await loadStaffSummaries(
      supabase,
      [finalDetail.request!.requested_by, ...approvals.map((approval) => approval.approver_id)]
    );
  } catch (summaryError) {
    console.error('Failed to load decision summaries', summaryError);
    return new Response('failed to refresh release detail', { status: 500 });
  }

  if (triggeredEvent) {
    const requestRecord = finalDetail.request!;
    const requester = staffSummaries.get(requestRecord.requested_by) ?? null;
    const approvedEmails = approvals
      .filter((approval) => approval.decision === 'approve')
      .map((approval) => staffSummaries.get(approval.approver_id)?.email ?? null)
      .filter((email): email is string => Boolean(email));

    const uniqueApproved = Array.from(
      new Map(approvedEmails.map((email) => [email.toLowerCase(), email])).values()
    );

    try {
      await sendEvent(triggeredEvent, {
        id: requestRecord.id,
        title: requestRecord.title,
        requested_by_email: requester?.email ?? null,
        approved_by_emails: uniqueApproved,
        decided_at: requestRecord.last_decision_at ?? new Date().toISOString()
      });
    } catch (error) {
      console.warn('[notify] failed to dispatch release notification', error);
    }
  }

  const responseBody = {
    viewer: {
      email: viewer.email,
      roles,
      user_id: staff.user_id,
      display_name: staff.display_name,
      has_security_admin: true,
      has_decided: approvals.some((approval) => approval.approver_id === staff.user_id)
    },
    request: {
      ...finalDetail.request!,
      approve_count: Number(finalDetail.request!.approve_count ?? 0),
      reject_count: Number(finalDetail.request!.reject_count ?? 0),
      requested_by_user: staffSummaries.get(finalDetail.request!.requested_by) ?? null
    },
    approvals: approvals.map((approval) => ({
      ...approval,
      approver: staffSummaries.get(approval.approver_id) ?? null
    }))
  };

  return NextResponse.json(responseBody);
}
