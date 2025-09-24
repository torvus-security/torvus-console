import { getRequesterEmail } from './auth';
import { createSupabaseServiceRoleClient } from './supabase';
import { evaluateAccessGate } from './authz/gate';

export type SelfProfile = {
  user_id: string;
  email: string;
  display_name: string;
  roles: string[];
};

export async function getSelf(request: Request): Promise<SelfProfile | null> {
  const email = getRequesterEmail(request);
  if (!email) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const evaluation = await evaluateAccessGate(email, { client: supabase });

  if (!evaluation.userId) {
    return null;
  }

  return {
    user_id: evaluation.userId,
    email: evaluation.email,
    display_name: evaluation.displayName ?? evaluation.email,
    roles: evaluation.roles
  };
}
