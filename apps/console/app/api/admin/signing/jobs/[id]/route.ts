import { NextResponse } from 'next/server';

import { getIdentityFromRequestHeaders, getUserRolesByEmail } from '../../../../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../../../../lib/supabase/admin';
import { getSigningJob } from '../../../../../../lib/rpc/signing';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export async function GET(
  request: Request,
  context: { params: { id?: string } }
): Promise<Response> {
  const jobId = context.params.id;
  if (!jobId) {
    return new Response('missing job id', { status: 400 });
  }

  const { email } = getIdentityFromRequestHeaders(request.headers);
  if (!email) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  let roles: string[];
  try {
    roles = await getUserRolesByEmail(email, supabase);
  } catch (error) {
    console.error('[api:admin:signing:job] failed to resolve requester roles', error);
    return new Response('failed to resolve roles', { status: 500 });
  }

  if (!hasSecurityAdminRole(roles)) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const job = await getSigningJob(jobId);
    if (!job) {
      return new Response('not found', { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('[api:admin:signing:job] failed to load signing job', error);
    return new Response('failed to load signing job', { status: 500 });
  }
}
