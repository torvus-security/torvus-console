import { headers } from 'next/headers';
import { z } from 'zod';
import { requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 1000;

const FilterSchema = z.object({
  actor: z.string().trim().min(1).max(128).optional(),
  event: z.string().trim().min(1).max(128).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1)
});

type FilterValues = z.infer<typeof FilterSchema>;

type AuditEventRow = {
  id: string;
  actor: string;
  event: string;
  created_at: string;
  object: string | null;
  metadata: Record<string, unknown> | null;
};

async function fetchAuditEvents(filters: FilterValues) {
  const supabase = createSupabaseServiceRoleClient();
  let query = supabase
    .from('audit_events')
    .select('id, actor, event, created_at, object, metadata', { count: 'exact' })
    .order('created_at', { ascending: false });

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

  const fromIndex = (filters.page - 1) * PAGE_SIZE;
  const toIndex = fromIndex + PAGE_SIZE - 1;

  const { data, count, error } = await query.range(fromIndex, toIndex);

  if (error) {
    console.error('Failed to load audit events', error);
    throw new Error('Unable to load audit events');
  }

  return {
    events: (data ?? []) as AuditEventRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE
  };
}

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

const EXPORTABLE_FILTER_KEYS: Array<keyof FilterValues> = ['actor', 'event', 'from', 'to'];

function buildFormHiddenFields(filters: FilterValues) {
  const entries: Array<[string, string]> = [];
  for (const key of EXPORTABLE_FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      entries.push([key, value]);
    }
  }
  return entries;
}

export async function exportAuditCsv(formData: FormData) {
  'use server';
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
  'use server';
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

export default async function AuditEventsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const staffUser = await requireStaff({ permission: 'audit.read' });
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const filters = FilterSchema.parse({
    actor: typeof searchParams?.actor === 'string' ? searchParams?.actor : undefined,
    event: typeof searchParams?.event === 'string' ? searchParams?.event : undefined,
    from: typeof searchParams?.from === 'string' ? searchParams?.from : undefined,
    to: typeof searchParams?.to === 'string' ? searchParams?.to : undefined,
    page: typeof searchParams?.page === 'string' ? searchParams?.page : undefined
  });

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/audit-events',
    correlation_id: correlationId,
    env: process.env.NODE_ENV ?? 'development',
    user: staffUser.analyticsId
  });

  const { events, total, page, pageSize } = await fetchAuditEvents(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const query = new URLSearchParams();
  for (const key of EXPORTABLE_FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      query.set(key, value);
    }
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="audit-heading">
        <div className="panel__header">
          <h1 id="audit-heading">Audit events</h1>
          <span className="tag subtle">Evidence ready</span>
        </div>
        <form method="get" className="filters" data-testid="audit-filter-form">
          <label>
            Actor
            <input type="text" name="actor" defaultValue={filters.actor ?? ''} placeholder="alice@torvussecurity.com" />
          </label>
          <label>
            Event key
            <input type="text" name="event" defaultValue={filters.event ?? ''} placeholder="releases.execute" />
          </label>
          <label>
            From
            <input type="datetime-local" name="from" defaultValue={filters.from ?? ''} />
          </label>
          <label>
            To
            <input type="datetime-local" name="to" defaultValue={filters.to ?? ''} />
          </label>
          <button type="submit" className="button primary">Apply</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Actor</th>
                <th scope="col">Event</th>
                <th scope="col">Object</th>
                <th scope="col">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">No audit events match your filters.</td>
                </tr>
              )}
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toISOString()}</td>
                  <td>{event.actor}</td>
                  <td>{event.event}</td>
                  <td>{event.object ?? '—'}</td>
                  <td>
                    <pre className="metadata">{JSON.stringify(event.metadata ?? {}, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Page {page} of {totalPages} ({total} events)
          </span>
          <div className="pagination">
            <a
              className="button ghost"
              aria-disabled={page <= 1}
              href={`?${new URLSearchParams({ ...Object.fromEntries(query.entries()), page: String(Math.max(1, page - 1)) })}`}
            >
              Previous
            </a>
            <a
              className="button ghost"
              aria-disabled={page >= totalPages}
              href={`?${new URLSearchParams({ ...Object.fromEntries(query.entries()), page: String(Math.min(totalPages, page + 1)) })}`}
            >
              Next
            </a>
          </div>
        </div>
        <div className="export-buttons">
          <form action={exportAuditCsv}>
            {buildFormHiddenFields(filters).map(([name, value]) => (
              <input key={`csv-${name}`} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="button secondary">Export CSV</button>
          </form>
          <form action={exportAuditJson}>
            {buildFormHiddenFields(filters).map(([name, value]) => (
              <input key={`json-${name}`} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="button secondary">Export JSON</button>
          </form>
        </div>
      </section>
    </div>
  );
}
