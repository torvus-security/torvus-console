import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { verifyCfAccessAssertion } from './lib/auth/cfAccess';
import { buildReportToHeader, generateNonce } from './lib/security';
import { evaluateAccessGate } from './lib/authz/gate';

type ReadOnlyState = {
  enabled: boolean;
  message: string;
  allow_roles: string[];
};

const DEFAULT_READ_ONLY: ReadOnlyState = {
  enabled: false,
  message: 'Maintenance in progress',
  allow_roles: ['security_admin']
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PATH_PREFIXES = ['/api/admin/settings/read-only', '/api/breakglass/', '/api/auth/'];
const READ_ONLY_CACHE_TTL_MS = 10_000;
const ROLES_CACHE_TTL_MS = 10_000;
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/intake/', '/api/csp-report'];
const SELF_CHECK_PATH = '/api/selfcheck';
const FEATURE_REQUIRE_STAFF_SESSION = process.env.FEATURE_REQUIRE_STAFF_SESSION === 'true';

type CachedValue<T> = {
  expiresAt: number;
  value: T;
};

type ReadOnlyCache = CachedValue<ReadOnlyState> | null;
type RoleCache = Map<string, CachedValue<string[]>>;

const globalScope = globalThis as typeof globalThis & {
  __readOnlyState?: ReadOnlyCache;
  __roleCache?: RoleCache;
};

function ensureEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE' | 'SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function normaliseRoles(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<string>();
  for (const role of input) {
    if (typeof role !== 'string') {
      continue;
    }
    const trimmed = role.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed.toLowerCase());
  }

  return Array.from(unique);
}

function shouldBypass(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) {
    return false;
  }

  return !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function readAccessAssertion(request: NextRequest): string | null {
  const headerAssertion =
    request.headers.get('Cf-Access-Jwt-Assertion') ?? request.headers.get('cf-access-jwt-assertion');

  if (headerAssertion && headerAssertion.trim()) {
    return headerAssertion.trim();
  }

  const cookieToken = request.cookies.get('CF_Authorization')?.value;
  if (cookieToken && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
}

async function fetchReadOnlyState(): Promise<ReadOnlyState> {
  const now = Date.now();
  const cached = globalScope.__readOnlyState;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const supabaseUrl = ensureEnv('SUPABASE_URL');
  const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE');
  const url = `${supabaseUrl}/rest/v1/app_settings?select=value&key=eq.read_only`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=representation'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`unexpected status ${response.status}`);
    }

    const rows = (await response.json()) as Array<{ value?: Partial<ReadOnlyState> }>;
    const value = rows?.[0]?.value ?? null;
    const state: ReadOnlyState = {
      enabled: Boolean(value?.enabled),
      message: typeof value?.message === 'string' && value.message.trim()
        ? value.message.trim()
        : DEFAULT_READ_ONLY.message,
      allow_roles: normaliseRoles(value?.allow_roles).length
        ? normaliseRoles(value?.allow_roles)
        : [...DEFAULT_READ_ONLY.allow_roles]
    };

    if (!state.allow_roles.some((role) => role.toLowerCase() === 'security_admin')) {
      state.allow_roles.push('security_admin');
    }

    globalScope.__readOnlyState = {
      expiresAt: now + READ_ONLY_CACHE_TTL_MS,
      value: state
    };

    return state;
  } catch (error) {
    console.error('[middleware][read-only] failed to fetch state', error);
    return { ...DEFAULT_READ_ONLY };
  }
}

async function loadRolesForEmail(email: string | null): Promise<string[]> {
  if (!email) {
    return [];
  }

  const now = Date.now();
  const cache = (globalScope.__roleCache ??= new Map());
  const cached = cache.get(email);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const evaluation = await evaluateAccessGate(email);
    const value = Array.from(
      new Set(evaluation.roles.map((role) => role.trim().toLowerCase()))
    );
    cache.set(email, { value, expiresAt: now + ROLES_CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.error('[middleware][read-only] failed to resolve roles', error);
    return [];
  }
}

function applyResponseHeaders(response: NextResponse, correlationId: string) {
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
}

export async function middleware(request: NextRequest) {
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

  const readOnly = await fetchReadOnlyState();
  requestHeaders.set('x-read-only', String(readOnly.enabled));
  requestHeaders.set('x-read-only-message', readOnly.message);
  requestHeaders.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));

  const method = request.method.toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);
  const isApiRoute = pathname.startsWith('/api/');
  const protectedApi = isProtectedApiPath(pathname);
  const requireUiSession = FEATURE_REQUIRE_STAFF_SESSION && !isApiRoute;
  const allowCfForRequest = protectedApi || !requireUiSession;

  const supabaseAuthResponse = NextResponse.next();

  let authenticatedEmail: string | null = null;
  let authenticatedMethod: 'supabase' | 'cf-access' | null = null;
  let sessionUserId: string | null = null;
  let gateResult: Awaited<ReturnType<typeof evaluateAccessGate>> | null = null;

  if (protectedApi || requireUiSession) {
    try {
      const supabase = createMiddlewareClient({ req: request, res: supabaseAuthResponse }, {
        supabaseUrl: ensureEnv('SUPABASE_URL'),
        supabaseKey: ensureEnv('SUPABASE_ANON_KEY')
      });

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('[middleware][auth] failed to resolve Supabase session', error);
      }

      const user = data?.user ?? null;
      if (user) {
        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
        const isStaffSession = FEATURE_REQUIRE_STAFF_SESSION ? Boolean(metadata.is_staff) : true;

        if (isStaffSession) {
          authenticatedEmail = normaliseEmail(user.email ?? null);
          authenticatedMethod = 'supabase';
          sessionUserId = user.id;
        }
      }
    } catch (error) {
      console.error('[middleware][auth] unexpected Supabase middleware failure', error);
    }
  }

  if (!authenticatedEmail && allowCfForRequest) {
    const assertion = readAccessAssertion(request);
    if (assertion) {
      const claims = await verifyCfAccessAssertion(assertion);
      if (claims) {
        const claimEmail = normaliseEmail(
          (claims.email as string | undefined)
            ?? (typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined)
            ?? (typeof claims.name === 'string' ? claims.name : undefined)
        );

        if (claimEmail) {
          authenticatedEmail = claimEmail;
          authenticatedMethod = 'cf-access';
        }
      }
    }
  }

  if (authenticatedEmail) {
    requestHeaders.set('x-authenticated-staff-email', authenticatedEmail);
    requestHeaders.set('x-authenticated-staff-method', authenticatedMethod ?? 'unknown');
    if (sessionUserId) {
      requestHeaders.set('x-session-user-id', sessionUserId);
      requestHeaders.set('x-session-user-email', authenticatedEmail);
    }

    try {
      gateResult = await evaluateAccessGate(authenticatedEmail);
      requestHeaders.set('x-access-allowed', String(gateResult.allowed));
      if (gateResult.reasons.length) {
        requestHeaders.set('x-access-deny-reasons', gateResult.reasons.join(';'));
      }
    } catch (gateError) {
      console.error('[middleware][authz] failed to evaluate access gate', gateError);
      gateResult = null;
    }
  }

  const supabaseCookies = supabaseAuthResponse.cookies.getAll();

  if (protectedApi && !authenticatedEmail) {
    const unauthorized = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    for (const cookie of supabaseCookies) {
      unauthorized.cookies.set(cookie);
    }
    unauthorized.headers.set('x-read-only', String(readOnly.enabled));
    unauthorized.headers.set('x-read-only-message', readOnly.message);
    unauthorized.headers.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));
    applyResponseHeaders(unauthorized, correlationId);
    return unauthorized;
  }

  if (protectedApi && pathname !== SELF_CHECK_PATH && gateResult && !gateResult.allowed) {
    const forbidden = NextResponse.json(
      {
        error: 'forbidden',
        reasons: gateResult.reasons
      },
      { status: 403 }
    );
    for (const cookie of supabaseCookies) {
      forbidden.cookies.set(cookie);
    }
    forbidden.headers.set('x-read-only', String(readOnly.enabled));
    forbidden.headers.set('x-read-only-message', readOnly.message);
    forbidden.headers.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));
    applyResponseHeaders(forbidden, correlationId);
    return forbidden;
  }

  if (readOnly.enabled && isMutating && isApiRoute && protectedApi && !shouldBypass(pathname)) {
    if (!authenticatedEmail) {
      const response = NextResponse.json(
        {
          error: 'read_only',
          message: readOnly.message
        },
        {
          status: 503
        }
      );
      for (const cookie of supabaseCookies) {
        response.cookies.set(cookie);
      }
      response.headers.set('x-read-only', 'true');
      response.headers.set('x-read-only-message', readOnly.message);
      response.headers.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));
      applyResponseHeaders(response, correlationId);
      return response;
    }

    const roles = gateResult
      ? gateResult.roles.map((role) => role.toLowerCase())
      : await loadRolesForEmail(authenticatedEmail);
    const allowedSet = new Set(readOnly.allow_roles.map((role) => role.toLowerCase()));
    const allowed = roles.some((role) => allowedSet.has(role));

    if (!allowed) {
      const response = NextResponse.json(
        {
          error: 'read_only',
          message: readOnly.message
        },
        {
          status: 503
        }
      );
      for (const cookie of supabaseCookies) {
        response.cookies.set(cookie);
      }
      response.headers.set('x-read-only', 'true');
      response.headers.set('x-read-only-message', readOnly.message);
      response.headers.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));
      applyResponseHeaders(response, correlationId);
      return response;
    }
  }

  let response: NextResponse;

  if (!isApiRoute && pathname !== SELF_CHECK_PATH && gateResult && !gateResult.allowed && pathname !== '/access-denied') {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = '/access-denied';
    response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders
      }
    });
  } else if (pathname === '/') {
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

  for (const cookie of supabaseCookies) {
    response.cookies.set(cookie);
  }

  response.headers.set('x-read-only', String(readOnly.enabled));
  response.headers.set('x-read-only-message', readOnly.message);
  response.headers.set('x-read-only-allow-roles', readOnly.allow_roles.join(','));

  applyResponseHeaders(response, correlationId);

  return response;
}

export const config = {
  matcher: [
    // exclude Next static assets + common files + Cloudflare endpoints
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|site.webmanifest|cdn-cgi/).*)',
  ],
};
