import { cookies, headers } from 'next/headers';
import { decodeJwt } from 'jose';

type MaybeRecord = Record<string, unknown>;

export type CfAccessClaims = {
  email?: string;
} & MaybeRecord;

function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function readHeaderEmail(): string | null {
  const headerBag = headers();
  const candidateHeaders = [
    'cf-access-authenticated-user-email',
    'x-authenticated-user-email',
    'x-auth-email',
    'x-forwarded-email'
  ];

  for (const name of candidateHeaders) {
    const value = headerBag.get(name);
    const email = normaliseEmail(value ?? undefined);
    if (email) {
      return email;
    }
  }
  return null;
}

function readAccessJwt(): string | null {
  const headerBag = headers();
  const assertion = headerBag.get('Cf-Access-Jwt-Assertion') ?? headerBag.get('cf-access-jwt-assertion');
  if (assertion && assertion.trim()) {
    return assertion.trim();
  }

  const cookieStore = cookies();
  const cookieToken = cookieStore.get('CF_Authorization')?.value;
  if (cookieToken && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
}

export function getCfAccessClaims(): CfAccessClaims | null {
  const token = readAccessJwt();
  if (!token) {
    return null;
  }

  try {
    const claims = decodeJwt(token) as CfAccessClaims;
    return claims;
  } catch (error) {
    console.warn('Failed to decode Cloudflare Access JWT', error);
    return null;
  }
}

export function getCfAccessEmail(): string | null {
  const headerEmail = readHeaderEmail();
  if (headerEmail) {
    return headerEmail;
  }

  const claims = getCfAccessClaims();
  const claimEmail = normaliseEmail(
    (claims?.email as string | undefined)
      ?? (typeof claims?.preferred_username === 'string' ? claims.preferred_username : undefined)
      ?? (typeof claims?.name === 'string' ? claims.name : undefined)
  );

  return claimEmail ?? null;
}
