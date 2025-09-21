import { headers } from 'next/headers';
import { requireStaff } from '../../lib/auth';
import { getAnalyticsClient } from '../../lib/analytics';
import { listAuditEvents } from '../../lib/data/audit';
import { AuditMetaDetails } from '../../components/AuditMetaDetails';

function formatUtc(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

function formatTarget(targetType: string | null, targetId: string | null): string {
  const trimmedType = targetType?.trim() ?? '';
  const trimmedId = targetId?.trim() ?? '';

  if (!trimmedType && !trimmedId) {
    return '—';
  }

  if (trimmedType && trimmedId) {
    return `${trimmedType} • ${trimmedId}`;
  }

  return trimmedType || trimmedId;
}

export const runtime = 'nodejs';

export default async function AuditPage() {
  const staffUser = await requireStaff();
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const events = await listAuditEvents();

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/audit',
    correlation_id: correlationId,
    env: process.env.NODE_ENV ?? 'development',
    user: staffUser.analyticsId
  });

  const hasEvents = events.length > 0;

  return (
    <div className="page">
      <section className="panel" aria-labelledby="audit-heading">
        <div className="panel__header">
          <div>
            <h1 id="audit-heading">Audit</h1>
            <p className="muted">Latest security-relevant activity captured by the platform.</p>
          </div>
          <form action="/audit/export" method="get">
            <button type="submit" className="button secondary small">
              Export CSV
            </button>
          </form>
        </div>

        <div className="table-wrapper" role="region" aria-live="polite">
          <table>
            <thead>
              <tr>
                <th scope="col">Time (UTC)</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {!hasEvents && (
                <tr>
                  <td colSpan={5} className="empty">
                    <div className="muted">
                      No audit events available yet.
                      <br />
                      Ensure a <code>public.console_audit_events</code> view or <code>public.audit_events</code> table exists and is populated
                      by the backend.
                    </div>
                  </td>
                </tr>
              )}
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatUtc(event.occurredAt)}</td>
                  <td>{event.actorEmail ?? '—'}</td>
                  <td>
                    <div className="audit-action">
                      <span>{event.action ?? '—'}</span>
                      {event.meta ? <AuditMetaDetails meta={event.meta} /> : null}
                    </div>
                  </td>
                  <td>{formatTarget(event.targetType, event.targetId)}</td>
                  <td>{event.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
