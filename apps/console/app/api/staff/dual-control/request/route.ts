import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient } from '../../../../../lib/supabase/admin';
import { requireStaff } from '../../../../../lib/auth';
import { getAnalyticsClient } from '../../../../../lib/analytics';
import type { PermissionKey } from '../../../../../lib/rbac';
import type { DualControlRequestRow } from '../types';

const RequestSchema = z.object({
  actionKey: z.string().min(3).max(128),
  payload: z.record(z.any()).default({}),
  correlationId: z.string().min(8).max(128)
});

const ACTION_PERMISSIONS: Record<string, PermissionKey> = {
  'releases.execute': 'releases.execute',
  'policy.edit': 'policy.edit',
  'staff.manage': 'staff.manage'
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const staffUser = await requireStaff();
  const permission = ACTION_PERMISSIONS[parsed.data.actionKey] ?? 'policy.edit';

  if (!staffUser.permissions.includes(permission)) {
    return NextResponse.json({ error: 'Permission denied for requested action.' }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: upsertedData, error } = await (supabase
    .from('staff_dual_control_requests') as any)
    .upsert(
      {
        action_key: parsed.data.actionKey,
        payload: parsed.data.payload,
        correlation_id: parsed.data.correlationId,
        requested_by: staffUser.id,
        status: 'requested'
      } as Partial<DualControlRequestRow>,
      { onConflict: 'action_key,correlation_id' }
    )
    .select()
    .maybeSingle();

  const upsertedRequest = upsertedData as DualControlRequestRow | null;

  if (error) {
    console.error('Failed to create dual-control request', error);
    return NextResponse.json({ error: 'Unable to create request' }, { status: 500 });
  }

  const analytics = getAnalyticsClient();
  analytics.capture('dual_control_requested', {
    user: staffUser.analyticsId,
    action: parsed.data.actionKey,
    correlation_id: parsed.data.correlationId,
    env: process.env.NODE_ENV ?? 'development'
  });

  return NextResponse.json({ request: upsertedRequest });
}
