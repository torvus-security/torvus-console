import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import type { SigningJobRecord, SigningReceiptRecord } from '../../types/internal/signing';

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

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      signing_job_get: {
        Args: { p_id: string };
        Returns: SigningJobRecord | null;
      };
      signing_receipt_read: {
        Args: { p_id: string };
        Returns: SigningReceiptRecord | null;
      };
      signing_jobs_list: {
        Args: { p_limit: number; p_after: string | null };
        Returns: SigningJobRecord[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export function createSupabaseServerClient<TDatabase = Database>() {
  assertEnv();
  return createServerComponentClient<TDatabase>({ cookies }, {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_ANON_KEY!
  });
}

export function getSupabaseConfig() {
  assertEnv();
  return {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE!
  };
}
