import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import clsx from 'clsx';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { getStaffUser } from '../../lib/auth';
import {
  INVESTIGATION_SEVERITIES,
  INVESTIGATION_STATUSES,
  type InvestigationListItem
} from '../../lib/data/investigations';
import { listInvestigations } from '../../lib/data/investigations';
import NewInvestigationDialog from './components/NewInvestigationDialog';

export const metadata: Metadata = {
  title: 'Investigations | Torvus Console'
};

type SearchParams = Record<string, string | string[] | undefined>;

type ParsedFilters = {
  statuses: string[];
  severities: string[];
  assigned: 'any' | 'me' | 'unassigned';
  search: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  triage: 'Triage',
  in_progress: 'In progress',
  closed: 'Closed'
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function parseFilters(searchParams: SearchParams): ParsedFilters {
  const statusParams = toArray(searchParams.status);
  const severityParams = toArray(searchParams.severity);

  const assignedParam = typeof searchParams.assigned === 'string' ? searchParams.assigned : 'any';
  const assigned = assignedParam === 'me' || assignedParam === 'unassigned' ? assignedParam : 'any';

  const search = typeof searchParams.q === 'string' ? searchParams.q : '';

  return {
    statuses: statusParams.map((status) => status.toLowerCase()),
    severities: severityParams.map((severity) => severity.toLowerCase()),
    assigned,
    search
  };
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const palette: Record<string, string> = {
    open: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
    triage: 'border-amber-500/60 bg-amber-500/15 text-amber-200',
    in_progress: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
    closed: 'border-slate-700/70 bg-slate-800/60 text-slate-300'
  };

  const label = STATUS_LABELS[key] ?? key;
  const className = palette[key] ?? 'border-slate-700/70 bg-slate-800/60 text-slate-200';

  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', className)}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const key = severity.toLowerCase();
  const palette: Record<string, string> = {
    low: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
    medium: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
    high: 'border-amber-500/60 bg-amber-500/15 text-amber-200',
    critical: 'border-rose-500/70 bg-rose-500/10 text-rose-200'
  };

  const label = SEVERITY_LABELS[key] ?? key;
  const className = palette[key] ?? 'border-slate-700/70 bg-slate-800/60 text-slate-200';

  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', className)}>
      {label}
    </span>
  );
}

function AssigneeChip({ assignee }: { assignee: InvestigationListItem['assignedTo'] }) {
  if (!assignee?.id) {
    return <span className="text-xs text-slate-500">Unassigned</span>;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200">
      {assignee.displayName ?? assignee.email ?? 'Unknown'}
    </span>
  );
}

function InvestigationsSkeleton() {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-48 animate-pulse rounded-full bg-slate-800" />
        <div className="h-5 w-32 animate-pulse rounded-full bg-slate-800" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-2xl bg-slate-800/60" />
        ))}
      </div>
    </section>
  );
}

async function InvestigationsListSection({
  filters,
  viewerId
}: {
  filters: ParsedFilters;
  viewerId: string | null;
}) {
  const investigations = await listInvestigations({
    filters,
    viewerId,
    limit: 100
  });

  if (!investigations.length) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-100">Investigations</h1>
          <p className="text-sm text-slate-400">Track case work across the Torvus incident queue.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/70 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-100">No investigations match your filters</h2>
          <p className="mt-2 text-sm text-slate-400">Adjust the filters above or create a new investigation.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-slate-100">Investigations</h1>
        <p className="text-sm text-slate-400">Open, triage, and collaborate on Torvus case work.</p>
      </header>

      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-2xl border border-slate-800/60">
          <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">Title</th>
                <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                <th scope="col" className="px-6 py-3 font-semibold">Severity</th>
                <th scope="col" className="px-6 py-3 font-semibold">Updated</th>
                <th scope="col" className="px-6 py-3 font-semibold">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {investigations.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-medium text-slate-100">
                    <Link href={`/investigations/${item.id}`} className="hover:text-emerald-300">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="px-6 py-4 text-slate-300">{formatRelativeTime(item.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <AssigneeChip assignee={item.assignedTo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:hidden">
        {investigations.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/investigations/${item.id}`} className="text-lg font-semibold text-slate-100 hover:text-emerald-300">
                  {item.title}
                </Link>
                <p className="text-xs text-slate-400">Updated {formatRelativeTime(item.updatedAt)}</p>
              </div>
              <SeverityBadge severity={item.severity} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={item.status} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Assignee</dt>
                <dd className="mt-1">
                  <AssigneeChip assignee={item.assignedTo} />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function FiltersForm({ filters }: { filters: ParsedFilters }) {
  return (
    <form method="get" className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 text-slate-200 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-4 lg:grid-cols-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-widest text-slate-400">Status</legend>
          <div className="flex flex-wrap gap-2">
            {INVESTIGATION_STATUSES.map((status) => (
              <label key={status} className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  name="status"
                  value={status}
                  defaultChecked={filters.statuses.includes(status)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400 focus:ring-emerald-500"
                />
                <span>{STATUS_LABELS[status] ?? status}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-widest text-slate-400">Severity</legend>
          <div className="flex flex-wrap gap-2">
            {INVESTIGATION_SEVERITIES.map((severity) => (
              <label key={severity} className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  name="severity"
                  value={severity}
                  defaultChecked={filters.severities.includes(severity)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400 focus:ring-emerald-500"
                />
                <span>{SEVERITY_LABELS[severity] ?? severity}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="assigned" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Assignee
          </label>
          <select
            id="assigned"
            name="assigned"
            defaultValue={filters.assigned}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="any">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:w-64">
        <label htmlFor="q" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Search title
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.search}
          placeholder="Phishing triage"
          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 hover:text-emerald-100"
        >
          Apply
        </button>
        <Link
          href="/investigations"
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/40"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

export default async function InvestigationsPage({ searchParams }: { searchParams: SearchParams }) {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }

  const hasViewPermission = staffUser.permissions.includes('investigations.view');

  if (!hasViewPermission) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
        <p className="mt-4 max-w-md text-center text-sm text-slate-400">
          Investigations require investigator, security administrator, or auditor privileges.
        </p>
      </div>
    );
  }

  const filters = parseFilters(searchParams);
  const canManage = staffUser.permissions.includes('investigations.manage');

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Investigations</h1>
          <p className="text-sm text-slate-400">Lightweight case tracking for Torvus responders.</p>
        </div>
        <NewInvestigationDialog canManage={canManage} />
      </div>

      <FiltersForm filters={filters} />

      <Suspense fallback={<InvestigationsSkeleton />}>
        <InvestigationsListSection filters={filters} viewerId={staffUser.id} />
      </Suspense>
    </div>
  );
}
