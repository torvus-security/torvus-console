import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { getStaffUser } from '../../../lib/auth';
import { listAlerts } from '../../../lib/data/alerts';
import { loadAuthz } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const metadata: Metadata = {
  title: 'Alerts | Torvus Console'
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

function SeverityBadge({ severity }: { severity: string | null }) {
  const key = (severity ?? 'unknown').toLowerCase();
  const label = key === 'unknown' ? 'Unknown' : key.replace(/\b\w/g, (char) => char.toUpperCase());
  const styles: Record<string, string> = {
    low: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
    med: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
    medium: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
    high: 'border-amber-500/60 bg-amber-500/15 text-amber-200',
    critical: 'border-rose-500/70 bg-rose-500/10 text-rose-200'
  };
  const className = styles[key] ?? 'border-slate-700/70 bg-slate-800/60 text-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function OwnerChip({ email }: { email: string | null }) {
  if (!email) {
    return <span className="text-xs text-slate-500">Unassigned</span>;
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200">
      {email}
    </span>
  );
}

function AlertsSkeleton() {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 animate-pulse rounded-full bg-slate-800" />
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

async function AlertsListSection() {
  const alerts = await listAlerts();

  if (!alerts.length) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-100">Active alerts</h1>
          <p className="text-sm text-slate-400">Monitor incidents raised by Torvus detection sources.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/70 p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-100">No alerts yet</h2>
          <p className="mt-2 text-sm text-slate-400">
            Setup hint:{' '}
            <Link href="/docs" className="text-emerald-300 hover:text-emerald-200">
              review the alerts integration guide
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-200 shadow-2xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-slate-100">Active alerts</h1>
        <p className="text-sm text-slate-400">Monitor incidents raised by Torvus detection sources.</p>
      </header>

      <div className="flex flex-col gap-4 lg:hidden">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{alert.title}</h2>
                <p className="text-xs text-slate-400">{alert.source ?? 'Unknown source'}</p>
              </div>
              <SeverityBadge severity={alert.severity} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-1 font-medium text-slate-200">{formatUtc(alert.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Owner</dt>
                <dd className="mt-1">
                  <OwnerChip email={alert.ownerEmail} />
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
                <th scope="col" className="px-6 py-3 font-semibold">Severity</th>
                <th scope="col" className="px-6 py-3 font-semibold">Source</th>
                <th scope="col" className="px-6 py-3 font-semibold">Created (UTC)</th>
                <th scope="col" className="px-6 py-3 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {alerts.map((alert) => (
                <tr key={alert.id} className="transition hover:bg-slate-800/40">
                  <td className="px-6 py-4 font-medium text-slate-100">{alert.title}</td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-6 py-4 text-slate-300">{alert.source ?? 'Unknown source'}</td>
                  <td className="px-6 py-4 text-slate-300">{formatUtc(alert.createdAt)}</td>
                  <td className="px-6 py-4">
                    <OwnerChip email={alert.ownerEmail} />
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

export default async function AlertsPage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </div>
    );
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader title="Alerts" description="Monitor incidents raised by Torvus detection sources." />
      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsListSection />
      </Suspense>
    </div>
  );
}
