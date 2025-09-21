import { NextResponse } from 'next/server';
import { requireSecurityAdmin, maskWebhookUrl } from './_helpers';

export const dynamic = 'force-dynamic';

type WebhookRow = {
  id: string;
  kind: 'slack' | 'teams';
  url: string;
  enabled: boolean;
  description: string | null;
  created_at: string | null;
};

type PrefRow = {
  id: string;
  event: string;
  enabled: boolean;
};

function sanitiseWebhook(row: WebhookRow) {
  return {
    id: row.id,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    description: row.description,
    maskedUrl: maskWebhookUrl(row.url),
    createdAt: row.created_at
  };
}

function sanitisePref(row: PrefRow) {
  return {
    id: row.id,
    event: row.event,
    enabled: Boolean(row.enabled)
  };
}

export async function GET(request: Request) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  const { supabase } = resolution.context;

  const { data: webhookRows, error: webhookError } = await (supabase.from('outbound_webhooks') as any)
    .select('id, kind, url, enabled, description, created_at')
    .order('created_at', { ascending: true });

  if (webhookError) {
    console.error('[admin][integrations] failed to load webhooks', webhookError);
    return new Response('failed to load webhooks', { status: 500 });
  }

  const { data: prefRows, error: prefError } = await (supabase.from('notification_prefs') as any)
    .select('id, event, enabled')
    .order('event', { ascending: true });

  if (prefError) {
    console.error('[admin][integrations] failed to load notification prefs', prefError);
    return new Response('failed to load notification prefs', { status: 500 });
  }

  const webhooks = ((webhookRows as WebhookRow[] | null) ?? []).map(sanitiseWebhook);
  const events = ((prefRows as PrefRow[] | null) ?? []).map(sanitisePref);

  return NextResponse.json({ webhooks, events });
}
