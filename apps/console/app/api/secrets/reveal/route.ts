import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';
import { consumeReveal, getDecrypted, maskSecretTail } from '../../../../server/secrets';

const RevealSchema = z.object({
  requestId: z.string().uuid()
});

function assertSecurityAdmin(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const staffUser = await requireStaff();
  if (!assertSecurityAdmin(staffUser.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = RevealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const requestId = parsed.data.requestId;
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data: requestRow, error: requestError } = await (supabase.from('secret_change_requests') as any)
    .select('id, key, env, action, status, applied_at, reason, requested_by')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError && requestError.code !== 'PGRST116') {
    console.error('[api][secrets] failed to load reveal request', requestError);
    return NextResponse.json({ error: 'Failed to load reveal request' }, { status: 500 });
  }

  if (!requestRow) {
    return NextResponse.json({ error: 'Reveal request not found' }, { status: 404 });
  }

  if (requestRow.action !== 'reveal') {
    return NextResponse.json({ error: 'Request is not a reveal action' }, { status: 400 });
  }

  const reveal = await consumeReveal(requestId, staffUser.id);
  if (reveal) {
    return NextResponse.json({
      plaintext: reveal.plaintext,
      key: reveal.key,
      env: reveal.env
    });
  }

  try {
    const plaintext = await getDecrypted(requestRow.key, requestRow.env, {
      skipAudit: true,
      skipTouch: true
    });
    return NextResponse.json({ masked: maskSecretTail(plaintext), status: requestRow.status });
  } catch (error) {
    console.warn('[api][secrets] failed to mask reveal payload', error);
    return NextResponse.json({ masked: '••••', status: requestRow.status });
  }
}
