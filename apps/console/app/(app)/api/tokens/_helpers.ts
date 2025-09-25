import { getIdentityFromRequestHeaders, getStaffUserByEmail } from '../../../../lib/auth';
import {
  SupabaseConfigurationError,
  createSupabaseServiceRoleClient
} from '../../../../lib/supabase';

type ResolutionSuccess = {
  ok: true;
  userId: string;
  email: string;
};

type ResolutionFailure = {
  ok: false;
  response: Response;
};

export type ResolutionResult = ResolutionSuccess | ResolutionFailure;

export function isResolutionFailure(resolution: ResolutionResult): resolution is ResolutionFailure {
  return resolution.ok === false;
}

export async function resolveTokenActor(request: Request): Promise<ResolutionResult> {
  const { email } = getIdentityFromRequestHeaders(request.headers);

  if (!email) {
    return { ok: false, response: new Response('unauthorized', { status: 401 }) };
  }

  let supabase;
  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error('personal token handling unavailable: Supabase not configured', error);
      return { ok: false, response: new Response('service unavailable', { status: 503 }) };
    }

    throw error;
  }

  try {
    const staffUser = await getStaffUserByEmail(email, supabase);
    if (!staffUser || !staffUser.user_id) {
      return { ok: false, response: new Response('forbidden', { status: 403 }) };
    }

    return { ok: true, userId: staffUser.user_id, email };
  } catch (error) {
    console.error('failed to resolve staff user for personal tokens', error);
    return { ok: false, response: new Response('failed to resolve staff user', { status: 500 }) };
  }
}
