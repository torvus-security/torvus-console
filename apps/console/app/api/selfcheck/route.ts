import { NextResponse } from 'next/server';
import { evaluateAccessGate } from '../../../lib/authz/gate';
import { verifyCfAccessAssertion } from '../../../lib/auth/cfAccess';

function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function readAccessAssertion(request: Request): string | null {
  const headerAssertion =
    request.headers.get('Cf-Access-Jwt-Assertion') ?? request.headers.get('cf-access-jwt-assertion');

  if (headerAssertion && headerAssertion.trim()) {
    return headerAssertion.trim();
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('CF_Authorization=')) {
      continue;
    }
    const token = trimmed.substring('CF_Authorization='.length).trim();
    if (token) {
      return token;
    }
  }

  return null;
}

const DEFAULT_FLAGS = {
  enrolled: false,
  verified: false,
  status: 'unknown',
  passkey_enrolled: false
} as const;

export async function GET(request: Request) {
  const assertion = readAccessAssertion(request);
  if (!assertion) {
    return NextResponse.json({
      email: '',
      allowed: false,
      reasons: ['cloudflare access session required'],
      flags: { ...DEFAULT_FLAGS },
      roles: [] as string[]
    });
  }

  const claims = await verifyCfAccessAssertion(assertion);
  if (!claims) {
    return NextResponse.json({
      email: '',
      allowed: false,
      reasons: ['invalid cloudflare access assertion'],
      flags: { ...DEFAULT_FLAGS },
      roles: [] as string[]
    });
  }

  const claimEmail = normaliseEmail(
    (claims.email as string | undefined)
      ?? (typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined)
      ?? (typeof claims.name === 'string' ? claims.name : undefined)
  );

  if (!claimEmail) {
    return NextResponse.json({
      email: '',
      allowed: false,
      reasons: ['unable to determine email from access assertion'],
      flags: { ...DEFAULT_FLAGS },
      roles: [] as string[]
    });
  }

  try {
    const evaluation = await evaluateAccessGate(claimEmail);
    return NextResponse.json({
      email: evaluation.email,
      allowed: evaluation.allowed,
      reasons: evaluation.reasons,
      flags: evaluation.flags,
      roles: evaluation.roles
    });
  } catch (error) {
    console.error('[api:selfcheck] failed to evaluate access gate', error);
    return NextResponse.json({
      email: claimEmail,
      allowed: false,
      reasons: ['gate evaluation failed'],
      flags: { ...DEFAULT_FLAGS },
      roles: [] as string[]
    });
  }
}
