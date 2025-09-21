import { NextResponse } from 'next/server';
import { getSelf } from '../../../lib/self';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const profile = await getSelf(request);
    if (!profile) {
      return new Response('unauthorized', { status: 401 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('failed to load self profile', error);
    return new Response('failed to resolve profile', { status: 500 });
  }
}
