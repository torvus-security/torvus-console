import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import {
  getIntegration,
  recordInbound,
  routeToInvestigation,
  verifySignature,
  extractVendorId,
  type IntakeIntegrationKind
} from '../../../server/intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deriveExtId(
  kind: IntakeIntegrationKind,
  payload: Record<string, unknown>,
  rawBody: string
): string {
  const vendorId = extractVendorId(kind, payload);
  if (vendorId) {
    return vendorId;
  }
  return createHash('sha256').update(rawBody, 'utf8').digest('hex');
}

export async function handleIntakeRequest(
  kind: IntakeIntegrationKind,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get('name')?.trim();
  if (!name) {
    return new Response('missing integration name', { status: 400 });
  }

  let integration = null;
  try {
    integration = await getIntegration(kind, name);
  } catch (error) {
    console.error('[intake] failed to load integration', error);
    return new Response('integration lookup failed', { status: 500 });
  }

  if (!integration || !integration.enabled) {
    return new Response('unauthorized', { status: 401 });
  }

  const rawBody = await request.text();
  if (!verifySignature(kind, rawBody, request.headers, integration.secret_hash)) {
    return new Response('invalid signature', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const extId = deriveExtId(kind, payload, rawBody);

  try {
    const result = await recordInbound(integration.id, extId, rawBody, payload);
    if (result.duplicate) {
      return NextResponse.json(
        { ok: true, investigation_id: null, action: 'appended' },
        { status: 202 }
      );
    }

    const routed = await routeToInvestigation(kind, payload);
    return NextResponse.json(
      {
        ok: true,
        investigation_id: routed.id,
        action: routed.action
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[intake] failed to handle inbound payload', error);
    return new Response('intake failure', { status: 500 });
  }
}
