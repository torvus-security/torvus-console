import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '../../../../lib/auth/staff';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api:staff:selftest] Supabase self-test failed', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error running Supabase self-test';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
