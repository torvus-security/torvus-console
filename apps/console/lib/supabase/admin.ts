import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabaseConfigurationError, getSupabaseConfig, type Database } from './index';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE'] as const;

function assertAdminEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new SupabaseConfigurationError(missing);
  }
}

let serviceRoleClient: SupabaseClient<Database> | null = null;

export function createSupabaseServiceRoleClient<TDatabase = Database>(): SupabaseClient<TDatabase> {
  assertAdminEnv();

  if (!serviceRoleClient) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    serviceRoleClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return serviceRoleClient as SupabaseClient<TDatabase>;
}
