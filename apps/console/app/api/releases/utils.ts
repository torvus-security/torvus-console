import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getIdentityFromRequestHeaders,
  getStaffUserByEmail,
  getUserRolesByEmail,
  type StaffUserRecord
} from '../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';

type ViewerOk = {
  type: 'ok';
  supabase: SupabaseClient<any>;
  email: string;
  roles: string[];
  staff: StaffUserRecord | null;
};

type ViewerError = {
  type: 'error';
  response: Response;
};

export type ViewerResolution = ViewerOk | ViewerError;

export async function resolveViewer(request: Request): Promise<ViewerResolution> {
  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return { type: 'error', response: new Response('unauthorized', { status: 401 }) };
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const [roles, staff] = await Promise.all([
      getUserRolesByEmail(email, supabase),
      getStaffUserByEmail(email, supabase)
    ]);

    return { type: 'ok', supabase, email, roles, staff } satisfies ViewerOk;
  } catch (error) {
    console.error('Failed to resolve viewer context', error);
    return { type: 'error', response: new Response('failed to resolve viewer context', { status: 500 }) };
  }
}

export function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export type ReleaseRequestViewRow = {
  id: string;
  title: string;
  description: string | null;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_at: string;
  last_decision_at: string | null;
  approve_count: number | null;
  reject_count: number | null;
};

export type StaffSummary = {
  user_id: string;
  email: string;
  display_name: string | null;
};

export type ReleaseApprovalRow = {
  id: number;
  request_id: string;
  approver_id: string;
  decision: 'approve' | 'reject';
  reason: string | null;
  created_at: string;
};

export async function loadStaffSummaries(
  supabase: SupabaseClient<any>,
  userIds: string[]
): Promise<Map<string, StaffSummary>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = Array.from(new Set(userIds));

  const { data, error } = await (supabase.from('staff_users') as any)
    .select('user_id, email, display_name')
    .in('user_id', uniqueIds);

  if (error) {
    throw error;
  }

  const rows = (data as StaffSummary[] | null) ?? [];
  return new Map(rows.map((row) => [row.user_id, row]));
}

export async function fetchReleaseDetail(
  supabase: SupabaseClient<any>,
  requestId: string
): Promise<{ request: ReleaseRequestViewRow | null; approvals: ReleaseApprovalRow[] }> {
  const { data: requestRow, error: requestError } = await (supabase.from('release_requests_with_counts') as any)
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  const request = (requestRow as ReleaseRequestViewRow | null) ?? null;

  if (!request) {
    return { request: null, approvals: [] };
  }

  const { data: approvalRows, error: approvalsError } = await (supabase.from('release_approvals') as any)
    .select('id, request_id, approver_id, decision, reason, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (approvalsError) {
    throw approvalsError;
  }

  const approvals = (approvalRows as ReleaseApprovalRow[] | null) ?? [];

  return { request, approvals };
}
