import { createSupabaseServiceRoleClient } from '../supabase';

export const INVESTIGATION_STATUSES = ['open', 'triage', 'in_progress', 'closed'] as const;
export const INVESTIGATION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];
export type InvestigationSeverity = (typeof INVESTIGATION_SEVERITIES)[number];

export type InvestigationUserRef = {
  id: string | null;
  email: string | null;
  displayName: string | null;
};

export type InvestigationListItem = {
  id: string;
  title: string;
  status: InvestigationStatus;
  severity: InvestigationSeverity;
  createdAt: string | null;
  updatedAt: string | null;
  summary: string | null;
  tags: string[];
  openedBy: InvestigationUserRef;
  assignedTo: InvestigationUserRef;
};

export type InvestigationDetail = InvestigationListItem;

export type InvestigationEvent = {
  id: string;
  investigationId: string;
  createdAt: string | null;
  actor: InvestigationUserRef;
  kind: 'note' | 'status_change' | 'assignment_change' | 'attachment';
  message: string | null;
  meta: Record<string, unknown>;
};

type InvestigationListRow = {
  id: string;
  title: string | null;
  status: string | null;
  severity: string | null;
  created_at: string | null;
  updated_at: string | null;
  summary: string | null;
  tags: string[] | null;
  opened_by: string | null;
  opened_by_email: string | null;
  opened_by_display_name: string | null;
  assigned_to: string | null;
  assigned_to_email: string | null;
  assigned_to_display_name: string | null;
};

type InvestigationEventRow = {
  id: string;
  investigation_id: string;
  created_at: string | null;
  actor_user_id: string | null;
  kind: 'note' | 'status_change' | 'assignment_change' | 'attachment';
  message: string | null;
  meta: Record<string, unknown> | null;
  actor_email: string | null;
  actor_display_name: string | null;
};

type InvestigationListFilters = {
  statuses?: string[];
  severities?: string[];
  assigned?: 'any' | 'me' | 'unassigned';
  search?: string;
};

function escapeILike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normaliseUserRef(
  id: string | null,
  email: string | null,
  displayName: string | null
): InvestigationUserRef {
  if (!id && !email && !displayName) {
    return { id: null, email: null, displayName: null };
  }

  return {
    id,
    email: email ? email.toLowerCase() : null,
    displayName: displayName ?? email ?? null
  };
}

function normaliseInvestigation(row: InvestigationListRow): InvestigationDetail {
  const status = (row.status ?? 'open').toLowerCase();
  const severity = (row.severity ?? 'medium').toLowerCase();

  return {
    id: row.id,
    title: row.title?.trim() ? row.title.trim() : 'Untitled investigation',
    status: INVESTIGATION_STATUSES.includes(status as InvestigationStatus)
      ? (status as InvestigationStatus)
      : 'open',
    severity: INVESTIGATION_SEVERITIES.includes(severity as InvestigationSeverity)
      ? (severity as InvestigationSeverity)
      : 'medium',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: row.summary ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    openedBy: normaliseUserRef(row.opened_by, row.opened_by_email, row.opened_by_display_name),
    assignedTo: normaliseUserRef(row.assigned_to, row.assigned_to_email, row.assigned_to_display_name)
  };
}

function normaliseEvent(row: InvestigationEventRow): InvestigationEvent {
  return {
    id: row.id,
    investigationId: row.investigation_id,
    createdAt: row.created_at,
    actor: normaliseUserRef(row.actor_user_id, row.actor_email, row.actor_display_name),
    kind: row.kind,
    message: row.message,
    meta: row.meta ?? {}
  };
}

export async function listInvestigations({
  limit = 50,
  filters = {},
  viewerId = null
}: {
  limit?: number;
  filters?: InvestigationListFilters;
  viewerId?: string | null;
} = {}): Promise<InvestigationListItem[]> {
  const supabase = createSupabaseServiceRoleClient();
  const finalLimit = Number.isFinite(limit) && limit! > 0 ? Math.floor(limit!) : 50;

  const query = (supabase.from('v_investigations_list') as any)
    .select(
      `id, title, status, severity, created_at, updated_at, summary, tags, opened_by, opened_by_email, opened_by_display_name, assigned_to, assigned_to_email, assigned_to_display_name`
    )
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(finalLimit);

  if (filters.statuses && filters.statuses.length) {
    const validStatuses = filters.statuses
      .map((status) => status.toLowerCase())
      .filter((status) => INVESTIGATION_STATUSES.includes(status as InvestigationStatus));
    if (validStatuses.length) {
      query.in('status', validStatuses);
    }
  }

  if (filters.severities && filters.severities.length) {
    const validSeverities = filters.severities
      .map((severity) => severity.toLowerCase())
      .filter((severity) => INVESTIGATION_SEVERITIES.includes(severity as InvestigationSeverity));
    if (validSeverities.length) {
      query.in('severity', validSeverities);
    }
  }

  if (filters.assigned === 'me') {
    if (viewerId) {
      query.eq('assigned_to', viewerId);
    } else {
      query.eq('assigned_to', '__never__');
    }
  } else if (filters.assigned === 'unassigned') {
    query.is('assigned_to', null);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${escapeILike(filters.search.trim())}%`;
    query.ilike('title', term);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01') {
      console.warn('[investigations] table missing, returning empty list');
      return [];
    }
    console.error('[investigations] failed to list investigations', error);
    return [];
  }

  const rows = (data as InvestigationListRow[] | null) ?? [];
  return rows.map(normaliseInvestigation);
}

export async function getInvestigationById(id: string): Promise<InvestigationDetail | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await (supabase.from('v_investigations_list') as any)
    .select(
      `id, title, status, severity, created_at, updated_at, summary, tags, opened_by, opened_by_email, opened_by_display_name, assigned_to, assigned_to_email, assigned_to_display_name`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      console.warn('[investigations] table missing when fetching detail');
      return null;
    }
    console.error('[investigations] failed to load investigation', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return normaliseInvestigation(data as InvestigationListRow);
}

export async function listInvestigationEvents(investigationId: string): Promise<InvestigationEvent[]> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await (supabase.from('investigation_events_with_actor') as any)
    .select('id, investigation_id, created_at, actor_user_id, kind, message, meta, actor_email, actor_display_name')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    if (error.code === '42P01') {
      console.warn('[investigations] events table missing, returning empty timeline');
      return [];
    }
    console.error('[investigations] failed to load investigation events', error);
    throw error;
  }

  const rows = (data as InvestigationEventRow[] | null) ?? [];
  return rows.map(normaliseEvent);
}

export async function countInvestigations(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  const { count, error } = await (supabase.from('investigations') as any)
    .select('id', { count: 'exact', head: true })
    .neq('status', 'closed');

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
