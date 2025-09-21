import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { getStaffUser } from '../../lib/auth';
import { listInvestigations } from '../../lib/data/investigations';

export const metadata: Metadata = {
  title: 'Investigations | Torvus Console'
};

function formatUtc(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    hour12: false,
    timeZone: 'UTC'
  });
}

function PriorityPill({ priority }: { priority: number | null }) {
  if (!priority || Number.isNaN(priority)) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200">
        —
      </span>
    );
  }
  const palette = priority <= 2
    ? 'border-rose-500/70 bg-rose-500/10 text-rose-200'
    : priority === 3
      ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
      : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${palette}`}>
      P{priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (status ?? 'unknown').toLowerCase();
  const label = key === 'unknown' ? 'Unknown' : key.replace(/\b\w/g, (char) => char.toUpperCase());
  const palette: Record<string, string> = {
    open: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
    on_hold: 'border-amber-500/60 bg-amber-500/15 text-amber-200',
    closed: 'border-slate-700/70 bg-slate-800/60 text-slate-300'
  };
  const className = palette[key] ?? 'border-slate-700/70 bg-slate-800/60 text-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function AssigneeChip({ email }: { email: string | null }) {
  if (!email) {
    return <span className="text-xs text-slate-500">Unassigned</span>;
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200">
      {email}
    </span>
  );
}

function InvestigationsSkeleton() {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 animate-pulse rounded-full bg-slate-800" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-slate-800" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-2xl bg-slate-800/60" />
        ))}
      </div>
    </section>
  );
}

async function InvestigationsListSection() {
  const investigations = await listInvestigations();

  if (!investigations.length) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-100">Open investigations</h1>
          <p className="text-sm text-slate-400">Track triage efforts assigned to Torvus operators.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/70 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-100">No open investigations</h2>
          <p className="mt-2 text-sm text-slate-400">Inbound investigations will appear here once created.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-slate-100">Open investigations</h1>
        <p className="text-sm text-slate-400">Track triage efforts assigned to Torvus operators.</p>
      </header>

      <div className="flex flex-col gap-4 lg:hidden">
        {investigations.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{item.title}</h2>
                <p className="text-xs text-slate-400">Updated {formatUtc(item.updatedAt)}</p>
              </div>
              <PriorityPill priority={item.priority} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1 font-medium text-slate-200">
                  <StatusBadge status={item.status} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Assignee</dt>
                <dd className="mt-1">
                  <AssigneeChip email={item.assigneeEmail} />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-2xl border border-slate-800/60">
          <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">Title</th>
                <th scope="col" className="px-6 py-3 font-semibold">Priority</th>
                <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                <th scope="col" className="px-6 py-3 font-semibold">Updated (UTC)</th>
                <th scope="col" className="px-6 py-3 font-semibold">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {investigations.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-medium text-slate-100">{item.title}</td>
                  <td className="px-6 py-4">
                    <PriorityPill priority={item.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-300">{formatUtc(item.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <AssigneeChip email={item.assigneeEmail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default async function InvestigationsPage() {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <Suspense fallback={<InvestigationsSkeleton />}>
        <InvestigationsListSection />
      </Suspense>
    </div>
  );
}
