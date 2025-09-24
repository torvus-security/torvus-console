'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { RoleBadge } from '../RoleBadge';

export type AdminPersonRecord = {
  user_id: string;
  email: string;
  display_name: string | null;
  passkey_enrolled: boolean;
  roles: string[];
};

export type PeopleTableProps = {
  people: AdminPersonRecord[];
};

function PasskeyBadge({ enrolled }: { enrolled: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        enrolled
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-700/70 bg-slate-800/80 text-slate-400'
      )}
    >
      {enrolled ? 'Yes' : 'No'}
    </span>
  );
}

function filterPeople(people: AdminPersonRecord[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return people;
  }

  return people.filter((person) => {
    const displayName = person.display_name ?? '';
    return (
      person.email.toLowerCase().includes(trimmed)
      || displayName.toLowerCase().includes(trimmed)
    );
  });
}

export function PeopleTable({ people }: PeopleTableProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterPeople(people, query), [people, query]);

  return (
    <section
      className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">Filter staff by email or display name.</p>
        <label
          className={clsx(
            'flex w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-within:border-slate-500',
            'sm:w-auto'
          )}
        >
          <span className="sr-only">Filter staff</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter staff"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800/60">
        <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm text-slate-200">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3">
                Email
              </th>
              <th scope="col" className="px-6 py-3">
                Display name
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-400">
                  No staff members match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((person) => (
                <tr key={person.user_id} className="transition hover:bg-slate-800/40">
                  <td className="px-6 py-4 text-sm font-medium text-slate-100">{person.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{person.display_name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {person.roles.length ? (
                        person.roles.map((role) => <RoleBadge key={`${person.user_id}-${role}`} role={role} />)
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <PasskeyBadge enrolled={person.passkey_enrolled} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
