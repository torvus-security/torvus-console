import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN; // e.g. torvussecurity.cloudflareaccess.com
const EXPECTED_AUD = process.env.CF_ACCESS_AUD; // Access app AUD tag

if (!TEAM_DOMAIN) {
  throw new Error("CF_ACCESS_TEAM_DOMAIN is not set");
}
if (!EXPECTED_AUD) {
  throw new Error("CF_ACCESS_AUD is not set");
}

// Cloudflare publishes JWKS at this well-known path
const JWKS = createRemoteJWKSet(new URL(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`));

export type VerifiedIdentity = {
  email: string;
  sub: string;
  exp?: number;
  iat?: number;
  iss: string;
  aud: string | string[];
  raw: JWTPayload;
};

export async function verifyAccessJwt(jwt: string): Promise<VerifiedIdentity> {
  // Verify signature and default claims first
  const { payload } = await jwtVerify(jwt, JWKS, {
    // issuer looks like: https://${TEAM_DOMAIN}
    issuer: `https://${TEAM_DOMAIN}`,
    audience: EXPECTED_AUD,
  });

  const email =
    (payload as any).email ||
    (payload as any).identity ||
    (payload as any)["cf-access-verified-email"] ||
    (payload.sub && payload.sub.includes("@") ? payload.sub : undefined);

  if (!email) {
    throw new Error("Verified JWT missing email claim");
  }

  return {
    email,
    sub: payload.sub ?? "",
    exp: payload.exp,
    iat: payload.iat,
    iss: payload.iss as string,
    aud: payload.aud as any,
    raw: payload,
  };
}

export type CfAccessClaims = (JWTPayload & { email?: string }) | null;

export async function verifyCfAccessAssertion(assertion: string | null | undefined): Promise<CfAccessClaims> {
  if (!assertion || !assertion.trim()) {
    return null;
  }

  try {
    const verified = await verifyAccessJwt(assertion.trim());
    return { ...verified.raw, email: verified.email };
  } catch (error) {
    console.warn("Failed to verify Cloudflare Access JWT", error);
    return null;
  }
}
