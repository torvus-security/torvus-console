import { createSupabaseServiceRoleClient } from '../supabase';

type AlertRow = {
  id: string;
  created_at: string | null;
  title: string | null;
  severity: string | null;
  source: string | null;
  status: string | null;
  owner_email: string | null;
};

export type AlertListItem = {
  id: string;
  createdAt: string | null;
  title: string;
  severity: string | null;
  source: string | null;
  status: string | null;
  ownerEmail: string | null;
};

function normaliseAlert(row: AlertRow): AlertListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title ?? 'Untitled alert',
    severity: row.severity,
    source: row.source,
    status: row.status,
    ownerEmail: row.owner_email
  };
}

function coerceLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit ?? NaN)) {
    return fallback;
  }
  const value = Math.floor(limit ?? fallback);
  if (value <= 0) {
    return fallback;
  }
  return value;
}

export async function listAlerts(limit = 50): Promise<AlertListItem[]> {
  const supabase = createSupabaseServiceRoleClient();
  const finalLimit = coerceLimit(limit, 50);

  const { data, error } = await (supabase.from('alerts') as any)
    .select('id, created_at, title, severity, source, status, owner_email')
    .eq('status', 'open')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(finalLimit);

  if (error) {
    if (error.code === '42P01') {
      console.warn('[alerts] alerts table missing, returning empty result');
      return [];
    }
    console.error('[alerts] failed to list alerts', error);
    return [];
  }

  const rows = (data as AlertRow[] | null) ?? [];
  return rows.map(normaliseAlert);
}

export async function countAlerts(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  const { count, error } = await (supabase.from('alerts') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) {
    if (error.code === '42P01') {
      console.warn('[alerts] alerts table missing, returning zero count');
      return 0;
    }
    console.error('[alerts] failed to count alerts', error);
    return 0;
  }

  return count ?? 0;
}
