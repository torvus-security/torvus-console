import { NextResponse } from 'next/server';
import { getIdentityFromRequestHeaders, getUserRolesByEmail, getStaffUserByEmail } from '../../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../../lib/supabase';
import { getReadOnly, setReadOnly } from '../../../../../server/settings';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export async function GET(request: Request) {
  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const roles = await getUserRolesByEmail(email, supabase);
    if (!hasSecurityAdminRole(roles)) {
      return new Response('forbidden', { status: 403 });
    }

    const settings = await getReadOnly();
    return NextResponse.json({ read_only: settings });
  } catch (error) {
    console.error('[api][admin][read-only] failed to load settings', error);
    return new Response('failed to load settings', { status: 500 });
  }
}

export async function POST(request: Request) {
  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const roles = await getUserRolesByEmail(email, supabase);
    if (!hasSecurityAdminRole(roles)) {
      return new Response('forbidden', { status: 403 });
    }

    let parsedBody: unknown;
    try {
      parsedBody = await request.json();
    } catch {
      return new Response('invalid json payload', { status: 400 });
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return new Response('invalid payload', { status: 400 });
    }

    const payload = parsedBody as Partial<{
      enabled: boolean;
      message: string;
      allow_roles: string[];
    }>;

    if (typeof payload.enabled !== 'boolean') {
      return new Response('enabled flag is required', { status: 400 });
    }

    const staff = await getStaffUserByEmail(email, supabase);
    const updated = await setReadOnly(payload.enabled, payload.message ?? '', payload.allow_roles, staff?.user_id ?? null);

    return NextResponse.json({ read_only: updated });
  } catch (error: any) {
    console.error('[api][admin][read-only] failed to update settings', error);
    const message = typeof error?.message === 'string' ? error.message : 'failed to update settings';
    return new Response(message, { status: 500 });
  }
}
