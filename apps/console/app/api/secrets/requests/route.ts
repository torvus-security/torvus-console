import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '../../../../lib/auth';
import {
  loadSecretRequests,
  proposeCreate,
  proposeReveal,
  proposeRotate
} from '../../../../server/secrets';

function assertSecurityAdmin(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

const RequestSchema = z.object({
  action: z.enum(['create', 'rotate', 'reveal']),
  key: z.string().min(3).max(200),
  env: z.string().min(1).max(64).default('prod'),
  plaintext: z.string().optional(),
  reason: z.string().min(5).max(2000),
  aad: z.string().max(500).optional().nullable()
});

export const dynamic = 'force-dynamic';

export async function GET() {
  const staffUser = await requireStaff();
  if (!assertSecurityAdmin(staffUser.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const requests = await loadSecretRequests(100);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[api][secrets] failed to list requests', error);
    return NextResponse.json({ error: 'Failed to load secret requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staffUser = await requireStaff();
  if (!assertSecurityAdmin(staffUser.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const payload = parsed.data;

  try {
    let requestId: string;
    switch (payload.action) {
      case 'create':
        if (!payload.plaintext) {
          return NextResponse.json({ error: 'Plaintext required for create' }, { status: 400 });
        }
        requestId = await proposeCreate(
          payload.key,
          payload.env,
          payload.plaintext,
          payload.reason,
          staffUser.id,
          { aad: payload.aad ?? null }
        );
        break;
      case 'rotate':
        if (!payload.plaintext) {
          return NextResponse.json({ error: 'Plaintext required for rotate' }, { status: 400 });
        }
        requestId = await proposeRotate(
          payload.key,
          payload.env,
          payload.plaintext,
          payload.reason,
          staffUser.id,
          { aad: payload.aad ?? null }
        );
        break;
      case 'reveal':
        requestId = await proposeReveal(payload.key, payload.env, payload.reason, staffUser.id);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    return NextResponse.json({ requestId });
  } catch (error: any) {
    console.error('[api][secrets] failed to create request', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
