import { NextResponse } from 'next/server';
import { requireSecurityAdmin } from '../../_helpers';

export const dynamic = 'force-dynamic';

type PrefRow = {
  id: string;
  event: string;
  enabled: boolean;
};

function sanitise(row: PrefRow) {
  return {
    id: row.id,
    event: row.event,
    enabled: Boolean(row.enabled)
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { event: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  const eventKey = decodeURIComponent(params.event ?? '').trim();
  if (!eventKey) {
    return new Response('invalid event', { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const enabled = Boolean((body as any)?.enabled);

  const { supabase } = resolution.context;

  const { data, error } = await (supabase.from('notification_prefs') as any)
    .update({ enabled })
    .eq('event', eventKey)
    .select('id, event, enabled')
    .maybeSingle();

  if (error) {
    console.error('[admin][integrations] failed to update notification pref', error);
    return new Response('failed to update notification', { status: 500 });
  }

  if (!data) {
    return new Response('not found', { status: 404 });
  }

  return NextResponse.json(sanitise(data as PrefRow));
}
