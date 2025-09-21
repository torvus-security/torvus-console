import Link from 'next/link';
import clsx from 'clsx';
import { RoleBadge } from './RoleBadge';
import type { StaffDirectoryEntry } from '../lib/data/staff';

export type StaffTableProps = {
  staff: StaffDirectoryEntry[];
  query: string;
  page: number;
  pageSize: number;
  totalCount: number;
};

function buildPageHref(page: number, query: string) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const queryString = params.toString();
  return `/staff${queryString ? `?${queryString}` : ''}`;
}

function PasskeyPill({ enrolled }: { enrolled: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        enrolled
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-700/70 bg-slate-800/80 text-slate-400'
      )}
    >
      {enrolled ? '✓ Passkey' : '—'}
    </span>
  );
}

export function StaffTable({ staff, query, page, pageSize, totalCount }: StaffTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Staff directory</h1>
          <p className="text-sm text-slate-400">
            Review privileged Torvus staff accounts and their assigned roles.
          </p>
        </div>
        <form method="get" className="w-full max-w-xs lg:w-auto">
          <label className="flex w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-within:border-slate-500">
            <span className="sr-only">Search staff</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search staff"
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </label>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800/60">
        <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm text-slate-200">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3">
                Display name
              </th>
              <th scope="col" className="px-6 py-3">
                Email
              </th>
              <th scope="col" className="px-6 py-3">
                Roles
              </th>
              <th scope="col" className="px-6 py-3">
                Passkey
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-400">
                  No staff members match your search.
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr
                  key={member.id}
                  className="transition hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/staff/${member.id}`}
                      className="text-sm font-medium text-slate-100 hover:text-emerald-300"
                    >
                      {member.displayName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">{member.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {member.roles.length ? (
                        member.roles.map((role) => <RoleBadge key={role} role={role} />)
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <PasskeyPill enrolled={member.passkeyEnrolled} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
        <span>
          {totalCount === 0
            ? 'No staff found'
            : `Showing ${from.toLocaleString()}-${to.toLocaleString()} of ${totalCount.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={buildPageHref(Math.max(1, page - 1), query)}
            aria-disabled={page <= 1}
            className={clsx(
              'rounded-full border border-slate-700/70 px-4 py-1.5 text-sm font-medium text-slate-200 transition',
              page > 1
                ? 'hover:border-emerald-400/50 hover:text-emerald-200'
                : 'cursor-not-allowed opacity-40'
            )}
            tabIndex={page > 1 ? undefined : -1}
          >
            Previous
          </Link>
          <span className="text-xs text-slate-500">
            Page {Math.min(page, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1), query)}
            aria-disabled={page >= totalPages}
            className={clsx(
              'rounded-full border border-slate-700/70 px-4 py-1.5 text-sm font-medium text-slate-200 transition',
              page < totalPages
                ? 'hover:border-emerald-400/50 hover:text-emerald-200'
                : 'cursor-not-allowed opacity-40'
            )}
            tabIndex={page < totalPages ? undefined : -1}
          >
            Next
          </Link>
        </div>
      </div>
    </section>
  );
}
