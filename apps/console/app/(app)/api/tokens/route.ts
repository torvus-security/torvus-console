import { NextResponse } from 'next/server';
import { createPat, listPats } from '../../../../server/pat';
import { resolveTokenActor } from './_helpers';

export const dynamic = 'force-dynamic';

type CreateTokenPayload = {
  name?: unknown;
  scopes?: unknown;
  expires_at?: unknown;
};

function parseScopes(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error('scopes must be an array');
  }

  const filtered = value.filter((scope): scope is string => typeof scope === 'string' && scope.trim().length > 0);
  return filtered.length ? filtered : [];
}

function parseExpiry(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('expires_at must be an ISO timestamp string');
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error('expires_at must be a valid ISO timestamp');
  }

  return new Date(timestamp);
}

export async function GET(request: Request) {
  const resolution = await resolveTokenActor(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  try {
    const tokens = await listPats(resolution.userId);
    return NextResponse.json(tokens, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('failed to list personal access tokens', error);
    return new Response('failed to list personal access tokens', { status: 500 });
  }
}

export async function POST(request: Request) {
  const resolution = await resolveTokenActor(request);
  if (!resolution.ok) {
    return resolution.response;
  }

  let payload: CreateTokenPayload;
  try {
    payload = (await request.json()) as CreateTokenPayload;
  } catch (error) {
    console.error('invalid JSON payload for personal access token creation', error);
    return new Response('invalid JSON payload', { status: 400 });
  }

  const rawName = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!rawName) {
    return new Response('name is required', { status: 400 });
  }

  let scopes: string[] | undefined;
  try {
    scopes = parseScopes(payload.scopes);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'invalid scopes', { status: 400 });
  }

  let expiresAt: Date | null | undefined;
  try {
    expiresAt = parseExpiry(payload.expires_at);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'invalid expires_at', { status: 400 });
  }

  try {
    const result = await createPat(resolution.userId, rawName, scopes, expiresAt ?? undefined);
    return NextResponse.json(result, {
      status: 201,
      headers: { 'cache-control': 'no-store' }
    });
  } catch (error) {
    console.error('failed to create personal access token', error);
    return new Response('failed to create personal access token', { status: 500 });
  }
}
