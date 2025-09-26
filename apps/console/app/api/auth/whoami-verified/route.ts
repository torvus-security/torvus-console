import { NextResponse } from "next/server";
import { getVerifiedUser } from "../../../../lib/auth/currentUser";

export async function GET() {
  try {
    const user = await getVerifiedUser();
    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unauthorized" },
      { status: 401 }
    );
  }
}
