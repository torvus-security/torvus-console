import { NextResponse } from 'next/server';
import { revokePat } from '../../../../../server/pat';
import { isResolutionFailure, resolveTokenActor } from '../_helpers';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id?: string;
  };
};

export async function DELETE(request: Request, context: RouteContext) {
  const resolution = await resolveTokenActor(request);
  if (isResolutionFailure(resolution)) {
    return resolution.response;
  }

  const tokenId = context.params.id;
  if (!tokenId) {
    return new Response('not found', { status: 404 });
  }

  try {
    const row = await revokePat(tokenId, resolution.userId);
    if (!row) {
      return new Response('not found', { status: 404 });
    }

    return NextResponse.json(row, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('failed to revoke personal access token', { tokenId, error });
    return new Response('failed to revoke personal access token', { status: 500 });
  }
}
