import { cookies, headers } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { normaliseStaffEmail } from './email';

type MaybeRecord = Record<string, unknown>;

export type CfAccessClaims = {
  email?: string;
} & MaybeRecord;

function normaliseAudience(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function getIssuer(): string | null {
  const issuer = process.env.CF_ACCESS_JWT_ISS;
  if (!issuer) {
    return null;
  }

  const trimmed = issuer.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const issuerUrl = new URL(trimmed);
    issuerUrl.pathname = issuerUrl.pathname.replace(/\/+$/, '');
    return issuerUrl.toString();
  } catch (error) {
    console.warn('Invalid CF_ACCESS_JWT_ISS value; ignoring', error);
    return null;
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  const issuer = getIssuer();
  if (!issuer) {
    return null;
  }

  if (!jwks) {
    try {
      const jwksUrl = new URL('/cdn-cgi/access/certs', issuer);
      jwks = createRemoteJWKSet(jwksUrl);
    } catch (error) {
      console.error('Failed to create CF Access JWKS client', error);
      return null;
    }
  }

  return jwks;
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

async function verifyAssertion(token: string): Promise<CfAccessClaims | null> {
  const jwkClient = getJwks();
  const audience = normaliseAudience(process.env.CF_ACCESS_JWT_AUD);
  const issuer = getIssuer();

  if (!jwkClient || !audience || !issuer) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwkClient, {
      issuer,
      audience
    });

    return payload as CfAccessClaims;
  } catch (error) {
    console.warn('Failed to verify Cloudflare Access JWT', error);
    return null;
  }
}

export async function verifyCfAccessAssertion(assertion: string | null | undefined): Promise<CfAccessClaims | null> {
  if (!assertion || !assertion.trim()) {
    return null;
  }

  return verifyAssertion(assertion.trim());
}

export async function getCfAccessClaims(): Promise<CfAccessClaims | null> {
  const token = readAccessJwt();
  if (!token) {
    return null;
  }

  return verifyCfAccessAssertion(token);
}

export async function getCfAccessEmail(): Promise<string | null> {
  const headerBag = headers();
  const forwardedEmail =
    headerBag.get('x-authenticated-staff-email') ??
    headerBag.get('x-session-user-email') ??
    headerBag.get('CF-Access-Authenticated-User-Email') ??
    headerBag.get('cf-access-authenticated-user-email');

  const normalisedHeader = normaliseStaffEmail(forwardedEmail);
  if (normalisedHeader) {
    return normalisedHeader;
  }

  const claims = await getCfAccessClaims();
  if (!claims) {
    return null;
  }

  const claimEmail = normaliseStaffEmail(
    (claims?.email as string | undefined)
      ?? (typeof claims?.preferred_username === 'string' ? claims.preferred_username : undefined)
      ?? (typeof claims?.name === 'string' ? claims.name : undefined)
  );

  return claimEmail ?? null;
}
