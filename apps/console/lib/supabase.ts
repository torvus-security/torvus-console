import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE'] as const;

export class SupabaseConfigurationError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(
      missing.length === 1
        ? `Missing required environment variable ${missing[0]}`
        : `Missing required environment variables: ${missing.join(', ')}`
    );
    this.name = 'SupabaseConfigurationError';
    this.missing = missing;
  }
}

export function isSupabaseConfigured(): boolean {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

export function isTransientSupabaseError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof TypeError && error.message.includes('fetch failed')) {
    return true;
  }

  if (typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message.includes('fetch failed')) {
      return true;
    }
  }

  if (typeof error === 'object' && error !== null && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === 'object' && 'code' in cause) {
      const code = String((cause as { code?: unknown }).code ?? '');
      if (code === 'ECONNREFUSED') {
        return true;
      }
    }
  }

  return false;
}

function assertEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new SupabaseConfigurationError(missing);
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
