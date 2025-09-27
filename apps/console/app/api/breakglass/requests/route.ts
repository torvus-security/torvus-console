import { NextRequest, NextResponse } from 'next/server';
import { getSelf } from '../../../../lib/self';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase/admin';
import { hasRoleAt } from '../../../../server/roles';
import { createRequest } from '../../../../server/breakglass';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set([
  'pending',
  'approved',
  'rejected',
  'executed',
  'expired',
  'revoked'
]);

function normaliseRoles(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const roles = value
    .map((role) => (typeof role === 'string' ? role.trim() : ''))
    .filter((role) => role.length > 0);

  if (roles.length === 0) {
    return null;
  }

  return Array.from(new Set(roles));
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('failed to parse break-glass request body', error);
    return new Response('invalid json body', { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return new Response('invalid body', { status: 400 });
  }

  const {
    target_user_id: targetUserId,
    roles: rawRoles,
    reason,
    ticket_url: ticketUrl,
    window_minutes: windowMinutes
  } = payload as Record<string, unknown>;

  const roles = normaliseRoles(rawRoles);
  if (!roles) {
    return new Response('roles are required', { status: 400 });
  }

  if (typeof targetUserId !== 'string' || targetUserId.trim().length === 0) {
    return new Response('target user id is required', { status: 400 });
  }

  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return new Response('reason is required', { status: 400 });
  }

  if (ticketUrl !== undefined && typeof ticketUrl !== 'string') {
    return new Response('ticket url must be a string', { status: 400 });
  }

  if (
    windowMinutes !== undefined &&
    (typeof windowMinutes !== 'number' || !Number.isFinite(windowMinutes) || windowMinutes <= 0)
  ) {
    return new Response('window minutes must be a positive number', { status: 400 });
  }

  try {
    const self = await getSelf(request);
    if (!self) {
      return new Response('unauthorized', { status: 401 });
    }

    const [isSecurityAdmin, isInvestigator] = await Promise.all([
      hasRoleAt(self.user_id, 'security_admin'),
      hasRoleAt(self.user_id, 'investigator')
    ]);

    if (!isSecurityAdmin && !isInvestigator) {
      return new Response('forbidden', { status: 403 });
    }

    const result = await createRequest({
      requesterUserId: self.user_id,
      targetUserId,
      roles,
      reason: reason.trim(),
      ticketUrl: typeof ticketUrl === 'string' ? ticketUrl.trim() || undefined : undefined,
      windowMinutes: typeof windowMinutes === 'number' ? windowMinutes : undefined
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('failed to create break-glass request', error);
    return new Response('failed to create request', { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const self = await getSelf(request);
    if (!self) {
      return new Response('unauthorized', { status: 401 });
    }

    const isSecurityAdmin = await hasRoleAt(self.user_id, 'security_admin');
    if (!isSecurityAdmin) {
      return new Response('forbidden', { status: 403 });
    }

    const statusParam = request.nextUrl.searchParams.get('status') ?? 'pending';
    if (!ALLOWED_STATUSES.has(statusParam)) {
      return new Response('invalid status', { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient<any>();

    let query = (supabase.from('elevation_requests') as any)
      .select(
        'id, created_at, requested_by, target_user_id, roles, reason, ticket_url, window_minutes, status, executed_at'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusParam) {
      query = query.eq('status', statusParam);
    }

    const { data, error } = await query;
    if (error) {
      console.error('failed to load break-glass requests', error);
      return new Response('failed to load requests', { status: 500 });
    }

    const rows = (data ?? []) as Array<{
      id: string;
      created_at: string;
      requested_by: string;
      target_user_id: string;
      roles: string[];
      reason: string;
      ticket_url: string | null;
      window_minutes: number;
      status: string;
      executed_at: string | null;
    }>;

    const ids = rows.map((row) => row.id);
    const approvalCounts = new Map<string, number>();

    if (ids.length > 0) {
      const { data: approvalsData, error: approvalsError } = await (supabase
        .from('elevation_approvals') as any)
        .select('request_id, approver_user_id')
        .in('request_id', ids);

      if (approvalsError) {
        console.error('failed to load break-glass approvals', approvalsError);
        return new Response('failed to load approvals', { status: 500 });
      }

      for (const row of (approvalsData as Array<{ request_id: string; approver_user_id: string }> | null) ?? []) {
        if (!row?.request_id || !row?.approver_user_id) {
          continue;
        }
        approvalCounts.set(row.request_id, (approvalCounts.get(row.request_id) ?? 0) + 1);
      }
    }

    const requests = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      requested_by: row.requested_by,
      target_user_id: row.target_user_id,
      roles: row.roles ?? [],
      reason: row.reason,
      ticket_url: row.ticket_url,
      window_minutes: row.window_minutes,
      status: row.status,
      executed_at: row.executed_at,
      approvals: approvalCounts.get(row.id) ?? 0
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('failed to list break-glass requests', error);
    return new Response('failed to list requests', { status: 500 });
  }
}
