import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';
import { requireStaff } from '../../../../lib/auth';
import { getAnalyticsClient } from '../../../../lib/analytics';

const ApproveSchema = z.object({
  id: z.string().uuid()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ApproveSchema.safeParse(body);

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
    console.error('Failed to load dual-control request', fetchError);
    return NextResponse.json({ error: 'Unable to load request' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (existing.requested_by === staffUser.id) {
    return NextResponse.json({ error: 'Dual-control approval requires a different approver.' }, { status: 403 });
  }

  if (existing.status !== 'requested') {
    return NextResponse.json({ error: `Cannot approve request in status ${existing.status}` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('staff_dual_control_requests')
    .update({
      approved_by: staffUser.id,
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', parsed.data.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to approve dual-control request', error);
    return NextResponse.json({ error: 'Unable to approve request' }, { status: 500 });
  }

  const analytics = getAnalyticsClient();
  analytics.capture('dual_control_approved', {
    user: staffUser.analyticsId,
    action: existing.action_key,
    correlation_id: existing.correlation_id,
    env: process.env.NODE_ENV ?? 'development'
  });

  return NextResponse.json({ request: data });
}
