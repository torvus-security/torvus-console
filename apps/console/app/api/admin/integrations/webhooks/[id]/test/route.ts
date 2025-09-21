import { NextResponse } from 'next/server';
import { validate as validateUuid } from 'uuid';
import { requireSecurityAdmin } from '../../../_helpers';
import { sendWebhookPreview } from '../../../../../../../server/notify';

export const dynamic = 'force-dynamic';

type WebhookRow = {
  id: string;
  kind: 'slack' | 'teams';
  url: string;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  const id = params.id;
  if (!id || !validateUuid(id)) {
    return new Response('invalid id', { status: 400 });
  }

  const { supabase } = resolution.context;

  const { data, error } = await (supabase.from('outbound_webhooks') as any)
    .select('id, kind, url')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin][integrations] failed to load webhook for test', error);
    return new Response('failed to load webhook', { status: 500 });
  }

  if (!data) {
    return new Response('not found', { status: 404 });
  }

  const webhook = data as WebhookRow;

  const success = await sendWebhookPreview(webhook, 'torvus.test', {
    message: 'Test notification from Torvus Console',
    triggered_at: new Date().toISOString()
  });

  if (!success) {
    return new Response('failed to deliver webhook', { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
