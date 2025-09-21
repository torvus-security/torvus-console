import { NextResponse } from 'next/server';
import { requireSecurityAdmin } from '../../../_helpers';
import { rotateIntegrationSecret, countEventsByIntegration } from '../../../../../../../server/intake';
import { normaliseSecret, serialiseIntegration } from '../../_helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  const id = params.id;
  if (!id) {
    return new Response('invalid id', { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const secret = normaliseSecret((body as any)?.secret);
  if (!secret) {
    return new Response('invalid secret', { status: 400 });
  }

  try {
    const row = await rotateIntegrationSecret(id, secret, request);
    if (!row) {
      return new Response('not found', { status: 404 });
    }
    const counts = await countEventsByIntegration();
    return NextResponse.json(serialiseIntegration(row, counts[row.id] ?? 0));
  } catch (error) {
    console.error('[admin][intake] failed to rotate secret', error);
    return new Response('failed to rotate secret', { status: 500 });
  }
}
