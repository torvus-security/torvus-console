import { NextResponse } from 'next/server';
import { getIdentityFromRequestHeaders } from '../../../lib/auth';
import { evaluateAccessGate } from '../../../lib/authz/gate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const identity = getIdentityFromRequestHeaders(request.headers);

  if (!identity.email) {
    return NextResponse.json(
      {
        email: null,
        roles: [],
        flags: null,
        source: identity.source
      },
      {
        status: 401,
        headers: { 'cache-control': 'no-store' }
      }
    );
  }

  try {
    const evaluation = await evaluateAccessGate(identity.email);
    return NextResponse.json(
      {
        email: evaluation.email,
        roles: evaluation.roles,
        flags: evaluation.flags,
        source: identity.source
      },
      {
        headers: { 'cache-control': 'no-store' }
      }
    );
  } catch (error) {
    console.error('failed to evaluate self profile', error);
    return NextResponse.json(
      {
        email: identity.email,
        roles: [],
        flags: null,
        source: identity.source
      },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' }
      }
    );
  }
}
