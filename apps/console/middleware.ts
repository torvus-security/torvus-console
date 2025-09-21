import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildReportToHeader, generateNonce } from './lib/security';

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  const { pathname } = request.nextUrl;
  const effectivePathname = pathname === '/' ? '/overview' : pathname;

  requestHeaders.set('x-csp-nonce', nonce);
  requestHeaders.set('x-pathname', effectivePathname);

  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  const hasCfCookie = request.cookies.has('CF_Authorization');
  const hasCfHeader = request.headers.has('cf-access-jwt-assertion');
  if (hasCfCookie || hasCfHeader) {
    requestHeaders.set('x-cloudflare-access', 'true');
  }

  let response: NextResponse;

  if (pathname === '/') {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = '/overview';
    response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders
      }
    });
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  response.headers.set('x-correlation-id', correlationId);

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
  matcher: [
    // exclude Next static assets + common files + Cloudflare endpoints
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|site.webmanifest|cdn-cgi/).*)',
  ],
};
