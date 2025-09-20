import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';

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
  const cookieStore = cookies();
  return createServerClient<TDatabase>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({
          name,
          value,
          ...options
        });
      },
      remove(name: string, options: any) {
        cookieStore.delete({
          name,
          ...options
        });
      }
    },
    headers: {
      Authorization: headers().get('Authorization') ?? ''
    }
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
