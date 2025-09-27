import { NextResponse } from 'next/server';

import { getIdentityFromRequestHeaders, getUserRolesByEmail } from '../../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../../lib/supabase/admin';
import { listSigningJobs } from '../../../../../lib/rpc/signing';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

function parseLimitParam(rawLimit: string | null): number | undefined {
  if (rawLimit === null || rawLimit.trim() === '') {
    return undefined;
  }

  const parsed = Number(rawLimit);
  if (Number.isNaN(parsed)) {
    throw new Error('invalid limit');
  }

  return parsed;
}

export async function GET(request: Request): Promise<Response> {
  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  let roles: string[];
  try {
    roles = await getUserRolesByEmail(email, supabase);
  } catch (error) {
    console.error('[api:admin:signing:jobs] failed to resolve requester roles', error);
    return new Response('failed to resolve roles', { status: 500 });
  }

  if (!hasSecurityAdminRole(roles)) {
    return new Response('forbidden', { status: 403 });
  }

  const url = new URL(request.url);

  let limit: number | undefined;
  try {
    limit = parseLimitParam(url.searchParams.get('limit'));
  } catch (error) {
    return new Response('invalid limit', { status: 400 });
  }

  const cursorParam = url.searchParams.get('cursor') ?? undefined;

  try {
    const result = await listSigningJobs({ limit, cursor: cursorParam ?? undefined });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid signing job cursor')) {
      return new Response(error.message, { status: 400 });
    }

    console.error('[api:admin:signing:jobs] failed to list signing jobs', error);
    return new Response('failed to list signing jobs', { status: 500 });
  }
}
