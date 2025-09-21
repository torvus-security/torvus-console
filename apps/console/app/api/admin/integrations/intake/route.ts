import { NextResponse } from 'next/server';
import { requireSecurityAdmin } from '../_helpers';
import { listIntegrations, countEventsByIntegration, upsertIntegration, getIntegration } from '../../../../../server/intake';
import {
  ALLOWED_INTAKE_KINDS,
  normaliseKind,
  normaliseName,
  normaliseSecret,
  serialiseIntegration
} from './_helpers';

export async function GET(request: Request) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  try {
    const [integrations, counts] = await Promise.all([listIntegrations(), countEventsByIntegration()]);
    const payload = integrations.map((row) => serialiseIntegration(row, counts[row.id] ?? 0));
    return NextResponse.json({ integrations: payload });
  } catch (error) {
    console.error('[admin][intake] failed to list integrations', error);
    return new Response('failed to list integrations', { status: 500 });
  }
}

export async function POST(request: Request) {
  const resolution = await requireSecurityAdmin(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const kind = normaliseKind((body as any)?.kind);
  if (!kind) {
    return new Response('invalid kind', { status: 400 });
  }

  const name = normaliseName((body as any)?.name);
  if (!name) {
    return new Response('invalid name', { status: 400 });
  }

  const secret = normaliseSecret((body as any)?.secret);
  if (!secret) {
    return new Response('invalid secret', { status: 400 });
  }

  try {
    if (!ALLOWED_INTAKE_KINDS.includes(kind)) {
      return new Response('invalid kind', { status: 400 });
    }

    const existing = await getIntegration(kind, name);
    if (existing) {
      return new Response('integration already exists', { status: 409 });
    }

    const row = await upsertIntegration(kind, name, secret, request);
    return NextResponse.json(serialiseIntegration(row, 0), { status: 201 });
  } catch (error) {
    console.error('[admin][intake] failed to create integration', error);
    return new Response('failed to create integration', { status: 500 });
  }
}
