import { NextResponse } from 'next/server';
import { requireSecurityAdmin, normaliseKind, normaliseDescription, isValidUrl, maskWebhookUrl } from '../_helpers';

export const dynamic = 'force-dynamic';

type InsertPayload = {
  kind: 'slack' | 'teams';
  url: string;
  enabled?: boolean;
  description?: string | null;
};

type WebhookRow = {
  id: string;
  kind: 'slack' | 'teams';
  url: string;
  enabled: boolean;
  description: string | null;
  created_at: string | null;
};

function sanitise(row: WebhookRow) {
  return {
    id: row.id,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    description: row.description,
    maskedUrl: maskWebhookUrl(row.url),
    createdAt: row.created_at
  };
}

export async function POST(request: Request) {
  const resolution = await requireSecurityAdmin(request);
  if (resolution.ok === false) {
    return resolution.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const kind = normaliseKind((body as Record<string, unknown> | null)?.kind);
  const url = typeof (body as Record<string, unknown> | null)?.url === 'string' ? (body as any).url.trim() : '';
  const description = normaliseDescription((body as Record<string, unknown> | null)?.description);

  if (!kind) {
    return new Response('invalid kind', { status: 400 });
  }

  if (!url || !isValidUrl(url)) {
    return new Response('invalid url', { status: 400 });
  }

  const payload: InsertPayload = {
    kind,
    url,
    enabled: true,
    description
  };

  const { supabase } = resolution.context;

  const { data, error } = await (supabase.from('outbound_webhooks') as any)
    .insert(payload)
    .select('id, kind, url, enabled, description, created_at')
    .single();

  if (error) {
    console.error('[admin][integrations] failed to insert webhook', error);
    return new Response('failed to add webhook', { status: 500 });
  }

  return NextResponse.json(sanitise(data as WebhookRow), { status: 201 });
}
