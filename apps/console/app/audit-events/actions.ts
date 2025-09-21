'use server';

import { requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';
import { FilterSchema, FilterValues, AuditEventRow } from './shared';

const EXPORT_LIMIT = 1000;

async function fetchExportEvents(filters: FilterValues) {
  const supabase = createSupabaseServiceRoleClient();
  let query = supabase
    .from('audit_events')
    .select('id, actor, event, created_at, object, metadata')
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT);

  if (filters.actor) {
    query = query.ilike('actor', `%${filters.actor}%`);
  }

  if (filters.event) {
    query = query.ilike('event', `%${filters.event}%`);
  }

  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }

  if (filters.to) {
    query = query.lte('created_at', filters.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to export audit events', error);
    throw new Error('Unable to export audit events');
  }

  return (data ?? []) as AuditEventRow[];
}

function buildFileName(prefix: string, extension: 'csv' | 'json') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.${extension}`;
}

function toCsv(events: AuditEventRow[]) {
  const header = 'id,actor,event,created_at,object,metadata';
  const rows = events.map((event) => {
    const metadata = event.metadata ? JSON.stringify(event.metadata).replace(/"/g, '""') : '';
    const object = event.object ? event.object.replace(/"/g, '""') : '';
    return [event.id, event.actor, event.event, event.created_at, object, metadata]
      .map((value) => `"${value}"`).join(',');
  });

  return [header, ...rows].join('\n');
}

function toJson(events: AuditEventRow[]) {
  return JSON.stringify(events, null, 2);
}

async function trackExport(events: AuditEventRow[], staffAnalyticsId: string, format: 'csv' | 'json') {
  const analytics = getAnalyticsClient();
  analytics.capture('audit_events_exported', {
    format,
    count: events.length,
    user: staffAnalyticsId,
    env: process.env.NODE_ENV ?? 'development'
  });
}

export async function exportAuditCsv(formData: FormData) {
  const staffUser = await requireStaff({ permission: 'audit.export' });
  const parsed = FilterSchema.safeParse(Object.fromEntries(formData.entries()));
  const filters: FilterValues = parsed.success ? parsed.data : { page: 1 };
  const events = await fetchExportEvents(filters);
  await trackExport(events, staffUser.analyticsId, 'csv');

  return new Response(toCsv(events), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${buildFileName('audit-events', 'csv')}"`
    }
  });
}

export async function exportAuditJson(formData: FormData) {
  const staffUser = await requireStaff({ permission: 'audit.export' });
  const parsed = FilterSchema.safeParse(Object.fromEntries(formData.entries()));
  const filters: FilterValues = parsed.success ? parsed.data : { page: 1 };
  const events = await fetchExportEvents(filters);
  await trackExport(events, staffUser.analyticsId, 'json');

  return new Response(toJson(events), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${buildFileName('audit-events', 'json')}"`
    }
  });
}
