import { NextResponse } from 'next/server';
import { validate as validateUuid } from 'uuid';
import {
  requireSecurityAdmin,
  normaliseDescription,
  maskWebhookUrl
} from '../../_helpers';

export const dynamic = 'force-dynamic';

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (resolution.ok === false) {
    return resolution.response;
  }

  const id = params.id;
  if (!id || !validateUuid(id)) {
    return new Response('invalid id', { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'enabled')) {
    updates.enabled = Boolean((body as any).enabled);
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'description')) {
    updates.description = normaliseDescription((body as any).description);
  }

  if (Object.keys(updates).length === 0) {
    return new Response('no changes', { status: 400 });
  }

  const { supabase } = resolution.context;

  const { data, error } = await (supabase.from('outbound_webhooks') as any)
    .update(updates)
    .eq('id', id)
    .select('id, kind, url, enabled, description, created_at')
    .maybeSingle();

  if (error) {
    console.error('[admin][integrations] failed to update webhook', error);
    return new Response('failed to update webhook', { status: 500 });
  }

  if (!data) {
    return new Response('not found', { status: 404 });
  }

  return NextResponse.json(sanitise(data as WebhookRow));
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (resolution.ok === false) {
    return resolution.response;
  }

  const id = params.id;
  if (!id || !validateUuid(id)) {
    return new Response('invalid id', { status: 400 });
  }

  const { supabase } = resolution.context;

  const { error } = await (supabase.from('outbound_webhooks') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[admin][integrations] failed to delete webhook', error);
    return new Response('failed to delete webhook', { status: 500 });
  }

  return new Response(null, { status: 204 });
}
