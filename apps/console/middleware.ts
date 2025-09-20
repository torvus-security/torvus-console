import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildContentSecurityPolicy, buildReportToHeader, CSP_REPORT_ENDPOINT, generateNonce } from './lib/security';

const STATUSPAGE_DOMAIN = process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID
  ? `https://${process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID}.statuspage.io`
  : process.env.NEXT_PUBLIC_STATUSPAGE_URL;

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-csp-nonce', nonce);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set('x-correlation-id', correlationId);

  const csp = buildContentSecurityPolicy({
    nonce,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    supabaseUrl: process.env.SUPABASE_URL,
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    statuspageEmbedUrl: STATUSPAGE_DOMAIN ?? undefined,
    reportUri: CSP_REPORT_ENDPOINT
  });

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', csp);
  } else {
    response.headers.set('Content-Security-Policy-Report-Only', csp);
  }

  response.headers.set('Report-To', buildReportToHeader());
  response.headers.set(
    'NEL',
    JSON.stringify({
      report_to: 'torvus-console-csp',
      max_age: 10886400,
      include_subdomains: false
    })
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|site.webmanifest).*)']
};
