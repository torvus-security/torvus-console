'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { AuditMetaDetails } from '../../components/AuditMetaDetails';

type RangeOption = '24h' | '7d' | '30d' | 'custom';

type AuditEvent = {
  id: string;
  happenedAt: string;
  action: string;
  actorEmail: string | null;
  actorRoles: string[];
  actorDisplayName: string | null;
  targetType: string | null;
  targetId: string | null;
  resource: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: unknown;
};

type FiltersState = {
  range: RangeOption;
  start: string | null;
  end: string | null;
  action: string | null;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
};

function computeRelativeRange(range: RangeOption): { start: string | null; end: string | null } {
  const now = new Date();

  switch (range) {
    case '24h': {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    default:
      return { start: null, end: null };
  }
}

type AuditClientProps = {
  initialEvents: AuditEvent[];
  initialHasMore: boolean;
  defaultFilters: FiltersState;
  availableActions: string[];
  availableTargetTypes: string[];
  pageSize: number;
};

function formatDateInput(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 16);
}

function toIsoString(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildQuery(filters: FiltersState, page: number, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  params.set('range', filters.range);

  if (filters.range === 'custom') {
    if (filters.start) {
      params.set('start', filters.start);
    }
    if (filters.end) {
      params.set('end', filters.end);
    }
  }

  if (filters.action) {
    params.set('action', filters.action);
  }

  if (filters.actor) {
    params.set('actor', filters.actor);
  }

  if (filters.targetType) {
    params.set('targetType', filters.targetType);
  }

  if (filters.targetId) {
    params.set('targetId', filters.targetId);
  }

  return params;
}

function buildExportUrl(filters: FiltersState): string {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.range === 'custom') {
    if (filters.start) {
      params.set('start', filters.start);
    }
    if (filters.end) {
      params.set('end', filters.end);
    }
  }
  if (filters.action) {
    params.set('action', filters.action);
  }
  if (filters.actor) {
    params.set('actor', filters.actor);
  }
  if (filters.targetType) {
    params.set('targetType', filters.targetType);
  }
  if (filters.targetId) {
    params.set('targetId', filters.targetId);
  }
  return `/api/audit/export?${params.toString()}`;
}

function renderRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function renderTooltip(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toUTCString();
}

function TargetCell({ type, id }: { type: string | null; id: string | null }) {
  if (!type && !id) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="stack-tight">
      {type ? <span className="text-sm font-medium">{type}</span> : null}
      {id ? <span className="muted text-xs">{id}</span> : null}
    </div>
  );
}

function ActorCell({
  displayName,
  email,
  roles,
  userAgent,
  ip
}: {
  displayName: string | null;
  email: string | null;
  roles: string[];
  userAgent: string | null;
  ip: string | null;
}) {
  if (!displayName && !email) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="stack-tight" title={userAgent ?? undefined}>
      <span className="font-medium">{displayName ?? email}</span>
      {displayName && email && displayName !== email ? <span className="muted text-xs">{email}</span> : null}
      {ip ? <span className="muted text-xs">IP: {ip}</span> : null}
      {roles.length > 0 ? (
        <div className="role-pill-group">
          {roles.map((role) => (
            <span key={role} className="role-pill">
              {role}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AuditClient({
  initialEvents,
  initialHasMore,
  defaultFilters,
  availableActions,
  availableTargetTypes,
  pageSize
}: AuditClientProps) {
  const [filters, setFilters] = useState<FiltersState>({ ...defaultFilters });
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const initialRenderRef = useRef(true);

  const filtersKey = useMemo(
    () =>
      JSON.stringify([
        filters.range,
        filters.start,
        filters.end,
        filters.action,
        filters.actor,
        filters.targetType,
        filters.targetId
      ]),
    [filters]
  );

  const exportUrl = useMemo(() => buildExportUrl(filters), [filters]);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError(null);

      const params = buildQuery(filters, nextPage, pageSize);

      try {
        const response = await fetch(`/api/audit/list?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = await response.json();

        if (requestRef.current !== requestId) {
          return;
        }

        const payload = json as {
          events: AuditEvent[];
          hasMore: boolean;
          page: number;
        };

        setEvents((prev) => (append ? [...prev, ...payload.events] : payload.events));
        setHasMore(payload.hasMore);
        setPage(payload.page);
      } catch (err: any) {
        console.error('Failed to load audit events', err);
        if (requestRef.current === requestId) {
          setError('Unable to load audit events. Please try again.');
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [filters, pageSize]
  );

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    void fetchPage(0, false);
  }, [fetchPage, filtersKey]);

  const onRangeChange = useCallback((value: RangeOption) => {
    setFilters((prev) => {
      if (value === 'custom') {
        return { ...prev, range: value };
      }

      const next = computeRelativeRange(value);
      return { ...prev, range: value, start: next.start, end: next.end };
    });
  }, []);

  const onClearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
  }, [defaultFilters]);

  const tableBody = useMemo(() => {
    if (events.length === 0 && !loading && !error) {
      return (
        <tr>
          <td colSpan={6} className="empty">
            <div className="muted text-center">
              <p className="font-medium">No audit events found for the selected filters.</p>
              <p className="text-sm">Adjust filters or broaden the date range to see more activity.</p>
            </div>
          </td>
        </tr>
      );
    }

    if (loading && events.length === 0) {
      return Array.from({ length: 6 }).map((_, index) => (
        <tr key={`skeleton-${index}`} className="table-skeleton">
          <td><span className="skeleton-line" /></td>
          <td><span className="skeleton-line" /></td>
          <td><span className="skeleton-line" /></td>
          <td><span className="skeleton-line" /></td>
          <td><span className="skeleton-line" /></td>
          <td><span className="skeleton-line" /></td>
        </tr>
      ));
    }

    return events.map((event) => (
      <tr key={event.id}>
        <td>
          <div className="stack-tight">
            <span className="font-medium">{event.action}</span>
          </div>
        </td>
        <td title={renderTooltip(event.happenedAt)}>{renderRelativeTime(event.happenedAt)}</td>
        <td>
          <ActorCell
            displayName={event.actorDisplayName}
            email={event.actorEmail}
            roles={event.actorRoles}
            userAgent={event.userAgent}
            ip={event.ip}
          />
        </td>
        <td>
          <TargetCell type={event.targetType} id={event.targetId} />
        </td>
        <td>{event.resource ?? <span className="muted">—</span>}</td>
        <td>
          <AuditMetaDetails meta={event.meta} />
        </td>
      </tr>
    ));
  }, [events, loading, error]);

  return (
    <div className="audit-ledger">
      <div className="panel__header">
        <div>
          <h1 id="audit-heading">Audit trail</h1>
          <p className="muted">Time-ordered ledger of privileged console activity.</p>
        </div>
        <div className="audit-actions">
          <a className="button secondary" href={exportUrl} rel="noopener noreferrer">
            Export CSV
          </a>
        </div>
      </div>

      <form className="audit-filters" onSubmit={(event) => event.preventDefault()}>
        <div className="filter-group">
          <label htmlFor="audit-range">Date range</label>
          <select
            id="audit-range"
            value={filters.range}
            onChange={(event) => onRangeChange(event.target.value as RangeOption)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {filters.range === 'custom' ? (
          <>
            <div className="filter-group">
              <label htmlFor="audit-start">Start (UTC)</label>
              <input
                id="audit-start"
                type="datetime-local"
                value={formatDateInput(filters.start)}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    start: toIsoString(event.target.value)
                  }))
                }
              />
            </div>
            <div className="filter-group">
              <label htmlFor="audit-end">End (UTC)</label>
              <input
                id="audit-end"
                type="datetime-local"
                value={formatDateInput(filters.end)}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    end: toIsoString(event.target.value)
                  }))
                }
              />
            </div>
          </>
        ) : null}
        <div className="filter-group">
          <label htmlFor="audit-action">Action</label>
          <input
            id="audit-action"
            list="audit-actions"
            value={filters.action ?? ''}
            placeholder="e.g. user_login"
            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value || null }))}
          />
          <datalist id="audit-actions">
            {availableActions.map((action) => (
              <option key={action} value={action} />
            ))}
          </datalist>
        </div>
        <div className="filter-group">
          <label htmlFor="audit-actor">Actor email contains</label>
          <input
            id="audit-actor"
            value={filters.actor ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, actor: event.target.value || null }))}
            placeholder="admin@torvussecurity.com"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="audit-target-type">Target type</label>
          <select
            id="audit-target-type"
            value={filters.targetType ?? ''}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, targetType: event.target.value || null }))
            }
          >
            <option value="">Any</option>
            {availableTargetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="audit-target-id">Target id</label>
          <input
            id="audit-target-id"
            value={filters.targetId ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, targetId: event.target.value || null }))}
            placeholder="INV-42"
          />
        </div>
        <div className="filter-actions">
          <button type="button" className="button ghost" onClick={onClearFilters}>
            Reset filters
          </button>
        </div>
      </form>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="table-wrapper" role="region" aria-live="polite">
        <table>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Time</th>
              <th scope="col">Actor</th>
              <th scope="col">Target</th>
              <th scope="col">Resource</th>
              <th scope="col">Meta</th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="muted text-sm">
          Showing {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="button secondary"
            disabled={loading || !hasMore}
            onClick={() => void fetchPage(page + 1, true)}
          >
            {hasMore ? (loading ? 'Loading…' : 'Load more') : 'No more results'}
          </button>
        </div>
      </div>
    </div>
  );
}
