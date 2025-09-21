import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import {
  fetchReleaseDetail,
  hasSecurityAdminRole,
  loadStaffSummaries,
  resolveViewer,
  type StaffSummary
} from '../../utils';

export const dynamic = 'force-dynamic';

function normaliseId(segment: string | string[] | undefined): string | null {
  if (typeof segment !== 'string') {
    return null;
  }
  return segment.trim() || null;
}

export type AuthorizationPayload = {
  request_id: string;
  title: string;
  status: 'approved';
  approved_by: string[];
  issued_at: string;
  expires_at: string;
};

export type AuthorizationResponseBody = AuthorizationPayload & {
  signature: string;
};

const CANONICAL_FIELDS: (keyof AuthorizationPayload)[] = [
  'request_id',
  'title',
  'status',
  'approved_by',
  'issued_at',
  'expires_at'
];

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

export async function GET(
  request: Request,
  context: { params?: { id?: string | string[] } }
): Promise<Response> {
  const id = normaliseId(context.params?.id);
  if (!id) {
    return new Response('invalid id', { status: 400 });
  }

  const signingKey = process.env.RELEASE_EXECUTOR_SIGNING_KEY;
  if (!signingKey) {
    console.error('RELEASE_EXECUTOR_SIGNING_KEY is not configured');
    return new Response('service unavailable', { status: 500 });
  }

  const viewer = await resolveViewer(request);
  if (viewer.type === 'error') {
    return viewer.response;
  }

  if (!hasSecurityAdminRole(viewer.roles)) {
    return new Response('forbidden', { status: 403 });
  }

  let detail;
  try {
    detail = await fetchReleaseDetail(viewer.supabase, id);
  } catch (error) {
    console.error('Failed to load release detail', error);
    return new Response('failed to load release detail', { status: 500 });
  }

  const requestRow = detail.request;
  if (!requestRow) {
    return new Response('not found', { status: 404 });
  }

  if (requestRow.status !== 'approved') {
    return new Response('release request is not approved', { status: 409 });
  }

  const approvingDecisions = detail.approvals.filter((approval) => approval.decision === 'approve');

  let approvingStaff: Map<string, StaffSummary>;
  try {
    approvingStaff = await loadStaffSummaries(
      viewer.supabase,
      approvingDecisions.map((approval) => approval.approver_id)
    );
  } catch (summaryError) {
    console.error('Failed to load approval summaries', summaryError);
    return new Response('failed to load approval summaries', { status: 500 });
  }

  const approvedBy = Array.from(
    new Set(
      approvingDecisions
        .map((approval) => approvingStaff.get(approval.approver_id)?.email)
        .filter((email): email is string => Boolean(email))
    )
  ).sort((a, b) => a.localeCompare(b));

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + FIFTEEN_MINUTES_IN_MS);

  const payload: AuthorizationPayload = {
    request_id: requestRow.id,
    title: requestRow.title,
    status: 'approved',
    approved_by: approvedBy,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString()
  };

  // The signature is calculated over the canonical JSON string of the payload without the signature field.
  const canonicalJson = JSON.stringify(payload, CANONICAL_FIELDS);
  const signature = createHmac('sha256', signingKey).update(canonicalJson).digest('base64url');

  const responseBody: AuthorizationResponseBody = {
    ...payload,
    signature
  };

  return NextResponse.json(responseBody);
}
