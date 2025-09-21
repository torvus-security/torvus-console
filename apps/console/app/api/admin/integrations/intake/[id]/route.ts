import { NextResponse } from 'next/server';
import { requireSecurityAdmin } from '../../_helpers';
import { setIntegrationEnabled, countEventsByIntegration } from '../../../../../../server/intake';
import { serialiseIntegration } from '../_helpers';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  const id = params.id;
  if (!id || typeof id !== 'string') {
    return new Response('invalid id', { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const enabledValue = (body as any)?.enabled;
  if (typeof enabledValue !== 'boolean') {
    return new Response('invalid enabled flag', { status: 400 });
  }

  try {
    const row = await setIntegrationEnabled(id, enabledValue);
    if (!row) {
      return new Response('not found', { status: 404 });
    }
    const counts = await countEventsByIntegration();
    return NextResponse.json(serialiseIntegration(row, counts[row.id] ?? 0));
  } catch (error) {
    console.error('[admin][intake] failed to toggle integration', error);
    return new Response('failed to update integration', { status: 500 });
  }
}
