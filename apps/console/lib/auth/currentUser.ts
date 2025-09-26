import { headers } from "next/headers";
import { verifyAccessJwt, VerifiedIdentity } from "./cfAccess";

export async function getVerifiedUser(): Promise<VerifiedIdentity> {
  const h = headers();
  const jwt = h.get("cf-access-jwt-assertion");
  if (!jwt) {
    throw new Error("Missing Cf-Access-Jwt-Assertion");
  }
  const verified = await verifyAccessJwt(jwt);
  return verified;
}
