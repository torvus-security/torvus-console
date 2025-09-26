import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // In Node, header names are always lowercase
  const jwt = req.headers.get("cf-access-jwt-assertion");
  const email = req.headers.get("cf-access-authenticated-user-email");

  return NextResponse.json({
    ok: true,
    sawHeaders: {
      "cf-access-jwt-assertion": jwt ? `present (${jwt.length} chars)` : "MISSING",
      "cf-access-authenticated-user-email": email || "MISSING",
    },
    note: "If either is MISSING, fix Cloudflare Access policy to emit them.",
  });
}
