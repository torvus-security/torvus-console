import { NextResponse } from 'next/server';
import { getSelf } from '../../../../lib/self';
import { createPat, listPats } from '../../../../server/pat';

export const dynamic = 'force-dynamic';

const VALID_SCOPES = new Set(['read', 'write']);

function parseScopes(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const filtered = value
    .map((scope) => (typeof scope === 'string' ? scope.trim() : ''))
    .filter((scope) => VALID_SCOPES.has(scope));

  return filtered.length ? Array.from(new Set(filtered)) : null;
}

function parseExpiry(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

export async function GET(request: Request) {
  const profile = await getSelf(request);
  if (!profile) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const tokens = await listPats(profile.user_id);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error('failed to list personal access tokens', error);
    return new Response('failed to list tokens', { status: 500 });
  }
}

export async function POST(request: Request) {
  const profile = await getSelf(request);
  if (!profile) {
    return new Response('unauthorized', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response('invalid json body', { status: 400 });
  }

  const name = typeof (payload as any)?.name === 'string' ? (payload as any).name.trim() : '';
  if (!name) {
    return new Response('name is required', { status: 400 });
  }

  if (name.length > 200) {
    return new Response('name is too long', { status: 400 });
  }

  const parsedScopes = parseScopes((payload as any)?.scopes);
  const parsedExpiry = parseExpiry((payload as any)?.expires_at);

  try {
    const result = await createPat(profile.user_id, name, parsedScopes ?? undefined, parsedExpiry ?? undefined);
    return NextResponse.json({ token: result.token, row: result.row });
  } catch (error: any) {
    console.error('failed to create personal access token', error);

    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return new Response('duplicate token name', { status: 409 });
    }

    return new Response('failed to create token', { status: 500 });
  }
}
