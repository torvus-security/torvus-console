import { NextResponse } from 'next/server';
import { getSelf } from '../../../../../../lib/self';
import { approveRequest, maybeExecute } from '../../../../../../server/breakglass';
import { hasRoleAt } from '../../../../../../server/roles';

export const dynamic = 'force-dynamic';

function normaliseId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const requestId = normaliseId(context?.params?.id);
  if (!requestId) {
    return new Response('invalid request id', { status: 400 });
  }

  try {
    const self = await getSelf(request);
    if (!self) {
      return new Response('unauthorized', { status: 401 });
    }

    const isSecurityAdmin = await hasRoleAt(self.user_id, 'security_admin');
    if (!isSecurityAdmin) {
      return new Response('forbidden', { status: 403 });
    }

    const result = await approveRequest({
      requestId,
      approverUserId: self.user_id
    });

    const executed = (await maybeExecute(requestId)) || result.executed;

    return NextResponse.json({ approvals: result.approvals, executed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';

    if (
      message.includes('own elevation') ||
      message.includes('already recorded') ||
      message.includes('Cannot approve request')
    ) {
      return new Response('conflict', { status: 409 });
    }

    if (message.includes('not found')) {
      return new Response('not found', { status: 404 });
    }

    console.error('failed to approve break-glass request', error);
    return new Response('failed to approve request', { status: 500 });
  }
}
