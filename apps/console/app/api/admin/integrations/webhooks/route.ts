import { NextResponse } from 'next/server';
import {
  requireSecurityAdmin,
  normaliseKind,
  normaliseDescription,
  maskWebhookUrl
} from '../_helpers';

export const dynamic = 'force-dynamic';

type InsertPayload = {
  kind: 'slack' | 'teams';
  url: string;
  enabled?: boolean;
  description?: string | null;
  secret_key?: string | null;
};

type WebhookRow = {
  id: string;
  kind: 'slack' | 'teams';
  url: string;
  enabled: boolean;
  description: string | null;
  created_at: string | null;
  secret_key: string | null;
};

function sanitise(row: WebhookRow) {
  return {
    id: row.id,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    description: row.description,
    maskedUrl: maskWebhookUrl(row.url, row.secret_key ?? null),
    secretKey: row.secret_key,
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
  const secretKey =
    typeof (body as Record<string, unknown> | null)?.secretKey === 'string'
      ? (body as any).secretKey.trim()
      : '';
  const description = normaliseDescription((body as Record<string, unknown> | null)?.description);

  if (!kind) {
    return new Response('invalid kind', { status: 400 });
  }

  if (!secretKey) {
    return new Response('secret key required', { status: 400 });
  }

  const payload: InsertPayload = {
    kind,
    url: `secret://${secretKey}`,
    enabled: true,
    description,
    secret_key: secretKey
  };

  const { supabase } = resolution.context;

  const { data, error } = await (supabase.from('outbound_webhooks') as any)
    .insert(payload)
    .select('id, kind, url, enabled, description, created_at, secret_key')
    .single();

  if (error) {
    console.error('[admin][integrations] failed to insert webhook', error);
    return new Response('failed to add webhook', { status: 500 });
  }

  return NextResponse.json(sanitise(data as WebhookRow), { status: 201 });
}
