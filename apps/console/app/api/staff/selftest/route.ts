import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServiceRoleClient } from '../../../../lib/supabase/admin';
import { listSigningJobs } from '../../../../lib/rpc/signing';

export const runtime = 'nodejs';

type TableCheckResult = {
  table: string;
  blocked: boolean;
  error?: string;
};

async function verifyTableReadBlocked(
  supabase: SupabaseClient,
  table: string
): Promise<TableCheckResult> {
  const { error } = (await (supabase.from(table) as any).select('id').limit(1)) as {
    error: { message?: string } | null;
  };

  if (error) {
    return { table, blocked: true, error: error.message };
  }

  return { table, blocked: false };
}

export async function GET() {
  const supabase = createSupabaseServiceRoleClient();

  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[api:staff:selftest] Supabase admin API check failed', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected error running Supabase admin self-test';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    await listSigningJobs({ limit: 1 });
  } catch (error) {
    console.error('[api:staff:selftest] Signing RPC health check failed', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected error invoking signing RPC endpoint';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const tableChecks = await Promise.all([
    verifyTableReadBlocked(supabase, 'signing_jobs'),
    verifyTableReadBlocked(supabase, 'signing_receipts')
  ]);

  const directReadAllowed = tableChecks.filter((check) => !check.blocked);

  if (directReadAllowed.length > 0) {
    console.error('[api:staff:selftest] Direct signing table read unexpectedly succeeded', {
      tables: directReadAllowed.map((check) => check.table)
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Direct signing table read unexpectedly succeeded',
        tables: directReadAllowed.map((check) => check.table)
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    supabase: {
      adminListUsers: true
    },
    signing: {
      rpcHealthy: true,
      directTableReadsBlocked: true,
      checks: tableChecks
    }
  });
}
