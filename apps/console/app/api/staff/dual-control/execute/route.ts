import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';
import { requireStaff } from '../../../../lib/auth';
import { getAnalyticsClient } from '../../../../lib/analytics';
import type { PermissionKey } from '../../../../lib/rbac';

const ExecuteSchema = z.object({
  id: z.string().uuid()
});

const EXECUTE_PERMISSIONS: Record<string, PermissionKey> = {
  'releases.execute': 'releases.execute',
  'policy.edit': 'policy.edit'
};

async function performExecutionStub(actionKey: string, payload: Record<string, unknown>) {
  console.info('[dual-control] executing action', actionKey, payload);
}

export async function POST(request: Request) {
  if (process.env.TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION !== '1') {
    return NextResponse.json({ error: 'Release execution disabled by feature flag.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ExecuteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  const staffUser = await requireStaff();
  const supabase = createSupabaseServiceRoleClient();

  const { data: existing, error: fetchError } = await supabase
    .from('staff_dual_control_requests')
    .select('*')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to fetch dual-control request', fetchError);
    return NextResponse.json({ error: 'Unable to load request' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (existing.status === 'executed') {
    return NextResponse.json({ request: existing });
  }

  if (existing.status !== 'approved') {
    return NextResponse.json({ error: `Cannot execute request in status ${existing.status}` }, { status: 409 });
  }

  if (!existing.approved_by) {
    return NextResponse.json({ error: 'Request must be approved before execution.' }, { status: 409 });
  }

  if (existing.approved_by === staffUser.id) {
    return NextResponse.json({ error: 'Executor must differ from approver.' }, { status: 403 });
  }

  const permission = EXECUTE_PERMISSIONS[existing.action_key] ?? 'releases.execute';
  if (!staffUser.permissions.includes(permission)) {
    return NextResponse.json({ error: 'Permission denied for execution.' }, { status: 403 });
  }

  await performExecutionStub(existing.action_key, existing.payload ?? {});

  const { data, error } = await supabase
    .from('staff_dual_control_requests')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString()
    })
    .eq('id', parsed.data.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to mark execution', error);
    return NextResponse.json({ error: 'Unable to execute request' }, { status: 500 });
  }

  const analytics = getAnalyticsClient();
  analytics.capture('dual_control_executed', {
    user: staffUser.analyticsId,
    action: existing.action_key,
    correlation_id: existing.correlation_id,
    env: process.env.NODE_ENV ?? 'development'
  });

  return NextResponse.json({ request: data });
}
