import { getRequesterEmail, getUserRolesByEmail } from './auth';
import { createSupabaseServiceRoleClient } from './supabase';

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

  type StaffRow = {
    user_id: string;
    email: string;
    display_name: string | null;
  } | null;

  const { data, error } = await (supabase.from('staff_users') as any)
    .select('user_id, email, display_name')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('failed to resolve self profile', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  let roles: string[] = [];
  try {
    roles = await getUserRolesByEmail(email, supabase);
  } catch (roleError) {
    console.error('failed to resolve self roles', roleError);
    throw roleError;
  }

  return {
    user_id: data.user_id,
    email: data.email.toLowerCase(),
    display_name: data.display_name ?? data.email,
    roles
  };
}
