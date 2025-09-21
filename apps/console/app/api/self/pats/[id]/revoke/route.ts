import { NextResponse } from 'next/server';
import { getSelf } from '../../../../../../lib/self';
import { revokePat } from '../../../../../../server/pat';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { id?: string } }
) {
  const profile = await getSelf(request);
  if (!profile) {
    return new Response('unauthorized', { status: 401 });
  }

  const param = context.params.id;
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) {
    return new Response('token id required', { status: 400 });
  }

  try {
    const row = await revokePat(id, profile.user_id);
    if (!row) {
      return new Response('not found', { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    console.error('failed to revoke personal access token', error);
    return new Response('failed to revoke token', { status: 500 });
  }
}
