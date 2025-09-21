import { createSupabaseServiceRoleClient } from '../supabase';

type InvestigationRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  title: string | null;
  priority: number | null;
  status: string | null;
  assignee_email: string | null;
};

export type InvestigationListItem = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  title: string;
  priority: number | null;
  status: string | null;
  assigneeEmail: string | null;
};

function normaliseInvestigation(row: InvestigationRow): InvestigationListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title ?? 'Untitled investigation',
    priority: row.priority,
    status: row.status,
    assigneeEmail: row.assignee_email
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

export async function listInvestigations(limit = 50): Promise<InvestigationListItem[]> {
  const supabase = createSupabaseServiceRoleClient();
  const finalLimit = coerceLimit(limit, 50);

  const { data, error } = await (supabase.from('investigations') as any)
    .select('id, created_at, updated_at, title, priority, status, assignee_email')
    .eq('status', 'open')
    .order('priority', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(finalLimit);

  if (error) {
    if (error.code === '42P01') {
      console.warn('[investigations] investigations table missing, returning empty result');
      return [];
    }
    console.error('[investigations] failed to list investigations', error);
    return [];
  }

  const rows = (data as InvestigationRow[] | null) ?? [];
  return rows.map(normaliseInvestigation);
}

export async function countInvestigations(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  const { count, error } = await (supabase.from('investigations') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) {
    if (error.code === '42P01') {
      console.warn('[investigations] investigations table missing, returning zero count');
      return 0;
    }
    console.error('[investigations] failed to count investigations', error);
    return 0;
  }

  return count ?? 0;
}
