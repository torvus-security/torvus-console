import { headers } from 'next/headers';
import { requireStaff } from '../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';
import { getAnalyticsClient } from '../../../lib/analytics';
import { PageHeader } from '../../../components/PageHeader';
import { exportAuditCsv, exportAuditJson } from './actions';
import { FilterSchema, FilterValues, AuditEventRow } from './shared';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

const PAGE_SIZE = 50;
const exportAuditCsvAction = exportAuditCsv as unknown as (formData: FormData) => Promise<void>;
const exportAuditJsonAction = exportAuditJson as unknown as (formData: FormData) => Promise<void>;

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

const EXPORTABLE_FILTER_KEYS: Array<Exclude<keyof FilterValues, 'page'>> = ['actor', 'event', 'from', 'to'];

function buildFormHiddenFields(filters: FilterValues) {
  const entries: Array<[string, string]> = [];
  for (const key of EXPORTABLE_FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === 'string' && value) {
      entries.push([key, value]);
    }
  }
  return entries;
}

export default async function AuditEventsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return (
      <div className="py-12">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </div>
    );
  }

  const hasAuditRole = authorizeRoles(authz, {
    anyOf: ['security_admin', 'auditor'],
    context: 'audit-events'
  });

  if (!hasAuditRole) {
    return (
      <div className="py-12">
        <DeniedPanel message="You need the security administrator or auditor role to review audit events." />
      </div>
    );
  }

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
    <div className="page flex flex-col gap-6">
      <PageHeader
        title="Audit events"
        description="Detailed activity log for compliance-ready evidence."
        headingId="audit-heading"
        actions={<span className="tag subtle">Evidence ready</span>}
      />

      <section className="panel" aria-labelledby="audit-heading">
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
          <form action={exportAuditCsvAction}>
            {buildFormHiddenFields(filters).map(([name, value]) => (
              <input key={`csv-${name}`} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="button secondary">Export CSV</button>
          </form>
          <form action={exportAuditJsonAction}>
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
