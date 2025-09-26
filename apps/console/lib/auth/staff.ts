const rawSupabaseUrl = process.env.SUPABASE_URL;
const rawSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!rawSupabaseUrl?.startsWith('https://') || !rawSupabaseUrl?.includes('.supabase.co')) {
  throw new Error('SUPABASE_URL is invalid. Expect like https://XXXX.supabase.co');
}

if (!rawSupabaseServiceRoleKey || rawSupabaseServiceRoleKey.length < 40) {
  throw new Error('SUPABASE_SERVICE_ROLE is missing or looks wrong.');
}

export const SUPABASE_URL = rawSupabaseUrl;
export const SUPABASE_SERVICE_ROLE = rawSupabaseServiceRoleKey;
