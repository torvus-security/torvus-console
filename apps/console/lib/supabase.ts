import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE'] as const;

function assertEnv() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable ${key}`);
    }
  }
}

export type Database = Record<string, never>; // Placeholder until Database types are generated

export function createSupabaseServerClient<TDatabase = Database>() {
  assertEnv();
  return createServerComponentClient<TDatabase>({ cookies }, {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_ANON_KEY!
  });
}

let serviceRoleClient: SupabaseClient<Database> | null = null;

export function createSupabaseServiceRoleClient<TDatabase = Database>(): SupabaseClient<TDatabase> {
  assertEnv();

  if (!serviceRoleClient) {
    serviceRoleClient = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return serviceRoleClient as SupabaseClient<TDatabase>;
}

export function getSupabaseConfig() {
  assertEnv();
  return {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE!
  };
}
