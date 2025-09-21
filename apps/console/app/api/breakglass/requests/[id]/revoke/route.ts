import { NextResponse } from 'next/server';
import { getSelf } from '../../../../../../lib/self';
import { revokeRequest } from '../../../../../../server/breakglass';
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

    const result = await revokeRequest({
      requestId,
      byUserId: self.user_id
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';

    if (message.includes('not found')) {
      return new Response('not found', { status: 404 });
    }

    console.error('failed to revoke break-glass request', error);
    return new Response('failed to revoke request', { status: 500 });
  }
}
