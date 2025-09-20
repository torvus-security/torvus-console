import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const report = await request.json();
    console.warn('[csp-report]', JSON.stringify(report));
  } catch (error) {
    console.warn('[csp-report] failed to parse report body', error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
