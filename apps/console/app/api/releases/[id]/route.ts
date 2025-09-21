import { NextResponse } from 'next/server';
import {
  fetchReleaseDetail,
  hasSecurityAdminRole,
  loadStaffSummaries,
  resolveViewer,
  type ReleaseApprovalRow,
  type ReleaseRequestViewRow,
  type StaffSummary
} from '../utils';

export const dynamic = 'force-dynamic';

function normaliseId(segment: string | string[] | undefined): string | null {
  if (typeof segment !== 'string') {
    return null;
  }
  return segment.trim() || null;
}

export async function GET(request: Request, context: { params?: { id?: string | string[] } }) {
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

  let detail;
  try {
    detail = await fetchReleaseDetail(supabase, id);
  } catch (error) {
    console.error('Failed to load release detail', error);
    return new Response('failed to load release detail', { status: 500 });
  }

  const requestRowData = detail.request;

  if (!requestRowData) {
    return new Response('not found', { status: 404 });
  }

  const approvals = detail.approvals as ReleaseApprovalRow[];

  const isSecurityAdmin = hasSecurityAdminRole(roles);
  const isOwner = requestRowData.requested_by === staff.user_id;

  if (!isSecurityAdmin && !isOwner) {
    return new Response('forbidden', { status: 403 });
  }

  let staffSummaries: Map<string, StaffSummary>;
  try {
    staffSummaries = await loadStaffSummaries(
      supabase,
      [requestRowData.requested_by, ...approvals.map((approval) => approval.approver_id)]
    );
  } catch (summaryError) {
    console.error('Failed to load release detail summaries', summaryError);
    return new Response('failed to load release detail', { status: 500 });
  }

  const responseBody = {
    viewer: {
      email: viewer.email,
      roles,
      user_id: staff.user_id,
      display_name: staff.display_name,
      has_security_admin: isSecurityAdmin,
      has_decided: approvals.some((approval) => approval.approver_id === staff.user_id)
    },
    request: {
      ...requestRowData,
      approve_count: Number(requestRowData.approve_count ?? 0),
      reject_count: Number(requestRowData.reject_count ?? 0),
      requested_by_user: staffSummaries.get(requestRowData.requested_by) ?? null
    },
    approvals: approvals.map((approval) => ({
      ...approval,
      approver: staffSummaries.get(approval.approver_id) ?? null
    }))
  };

  return NextResponse.json(responseBody);
}
