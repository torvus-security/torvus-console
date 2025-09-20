export async function POST(req: Request) {
  try {
    // Best-effort parse; keep it resilient
    await req.text();
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
