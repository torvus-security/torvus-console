import { createSupabaseServiceRoleClient } from '../lib/supabase/admin';

export type AuditEventRow = {
  id: string;
  happened_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_roles: string[] | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  resource: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: unknown;
};

export type AuditEventView = {
  id: string;
  happenedAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoles: string[];
  actorDisplayName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  resource: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: unknown;
};

export type AuditQuery = {
  limit: number;
  page: number;
  start?: string | null;
  end?: string | null;
  action?: string | null;
  actor?: string | null;
  targetType?: string | null;
  targetId?: string | null;
};

function coerceLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  const bounded = Math.max(1, Math.min(200, Math.floor(limit)));
  return bounded;
}

function coercePage(page: number): number {
  if (!Number.isFinite(page)) {
    return 0;
  }
  const bounded = Math.max(0, Math.floor(page));
  return bounded;
}

function normaliseIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function toViewRow(row: AuditEventRow, displayName: string | null): AuditEventView {
  return {
    id: row.id,
    happenedAt: row.happened_at,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actorRoles: Array.isArray(row.actor_roles) ? row.actor_roles : [],
    actorDisplayName: displayName,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    resource: row.resource,
    ip: row.ip,
    userAgent: row.user_agent,
    meta: row.meta ?? null
  };
}

export async function fetchAuditEvents(query: AuditQuery): Promise<{
  events: AuditEventView[];
  page: number;
  hasMore: boolean;
}> {
  const supabase = createSupabaseServiceRoleClient();
  const limit = coerceLimit(query.limit);
  const page = coercePage(query.page);
  const offset = page * limit;
  const endIndex = offset + limit;

  let builder = (supabase.from('audit_events') as any)
    .select(
      'id,happened_at,actor_user_id,actor_email,actor_roles,action,target_type,target_id,resource,ip,user_agent,meta'
    )
    .order('happened_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, endIndex);

  const startIso = normaliseIso(query.start ?? null);
  if (startIso) {
    builder = builder.gte('happened_at', startIso);
  }

  const endIso = normaliseIso(query.end ?? null);
  if (endIso) {
    builder = builder.lte('happened_at', endIso);
  }

  if (query.action && query.action.trim()) {
    builder = builder.eq('action', query.action.trim());
  }

  if (query.actor && query.actor.trim()) {
    builder = builder.ilike('actor_email', `%${query.actor.trim()}%`);
  }

  if (query.targetType && query.targetType.trim()) {
    builder = builder.eq('target_type', query.targetType.trim());
  }

  if (query.targetId && query.targetId.trim()) {
    builder = builder.ilike('target_id', `%${query.targetId.trim()}%`);
  }

  const { data, error } = (await builder) as { data: AuditEventRow[] | null; error: { message?: string } | null };

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AuditEventRow[];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const actorIds = new Set<string>();
  slice.forEach((row) => {
    if (row.actor_user_id) {
      actorIds.add(row.actor_user_id);
    }
  });

  const displayNameMap = new Map<string, string | null>();

  if (actorIds.size > 0) {
    const { data: staffRows, error: staffError } = (await (supabase.from('staff_users') as any)
      .select('user_id, display_name')
      .in('user_id', Array.from(actorIds))) as {
      data: Array<{ user_id: string; display_name: string | null }> | null;
      error: { message?: string } | null;
    };

    if (staffError) {
      throw staffError;
    }

    (staffRows ?? []).forEach((row) => {
      displayNameMap.set(row.user_id, row.display_name ?? null);
    });
  }

  const events = slice.map((row) => toViewRow(row, displayNameMap.get(row.actor_user_id ?? '') ?? null));

  return { events, page, hasMore };
}

async function fetchDistinctColumn(column: 'action' | 'target_type', limit = 200): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = (await (supabase.from('audit_events') as any)
    .select(`${column}`)
    .not(column, 'is', null)
    .order(column, { ascending: true })
    .limit(limit)) as { data: Array<Record<string, string | null>> | null; error: { message?: string } | null };

  if (error) {
    throw error;
  }

  const seen = new Set<string>();
  const values: string[] = [];

  (data ?? []).forEach((row) => {
    const value = (row as Record<string, string | null>)[column];
    if (!value) {
      return;
    }
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  });

  return values;
}

export async function fetchDistinctActions(limit = 200): Promise<string[]> {
  return fetchDistinctColumn('action', limit);
}

export async function fetchDistinctTargetTypes(limit = 200): Promise<string[]> {
  return fetchDistinctColumn('target_type', limit);
}
