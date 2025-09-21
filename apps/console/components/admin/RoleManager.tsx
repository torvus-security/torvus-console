'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';

type RoleDefinition = {
  id: string;
  name: string;
  description: string;
};

export type RoleMemberRecord = {
  user_id: string;
  email: string;
  display_name: string | null;
  roles: string[];
};

export type RoleManagerProps = {
  roles: RoleDefinition[];
  members: RoleMemberRecord[];
};

type StatusMessage = {
  type: 'success' | 'error';
  message: string;
};

function normaliseRoleName(role: string): string {
  return role.trim().toLowerCase();
}

function sortRoleNames(roles: string[]): string[] {
  const unique = Array.from(new Set(roles.map((role) => role.trim()).filter(Boolean)));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

function filterMembers(members: RoleMemberRecord[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return members;
  }

  return members.filter((member) => {
    const displayName = member.display_name ?? '';
    return (
      member.email.toLowerCase().includes(trimmed)
      || displayName.toLowerCase().includes(trimmed)
    );
  });
}

function describeMember(member: RoleMemberRecord | undefined): string {
  if (!member) {
    return 'the selected staff member';
  }

  if (member.display_name) {
    return `${member.display_name} (${member.email})`;
  }

  return member.email;
}

function RoleChip({
  role,
  onRemove,
  disabled
}: {
  role: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-200">
      <span>{role}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={clsx(
          'rounded-full p-0.5 text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 focus:ring-offset-slate-900',
          disabled && 'cursor-not-allowed opacity-40 hover:text-slate-300'
        )}
        aria-label={`Remove ${role}`}
      >
        ×
      </button>
    </span>
  );
}

export function RoleManager({ roles, members }: RoleManagerProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>(() => members[0]?.user_id ?? '');
  const [selectedRole, setSelectedRole] = useState<string>(() => roles[0]?.name ?? '');
  const [records, setRecords] = useState<RoleMemberRecord[]>(members);

  useEffect(() => {
    setRecords(members);
    setSelectedUser((current) => {
      if (current && members.some((member) => member.user_id === current)) {
        return current;
      }
      return members[0]?.user_id ?? '';
    });
  }, [members]);

  useEffect(() => {
    setSelectedRole((current) => {
      if (current && roles.some((role) => role.name === current)) {
        return current;
      }
      return roles[0]?.name ?? '';
    });
  }, [roles]);

  const filteredMembers = useMemo(() => filterMembers(records, query), [records, query]);

  function updateMemberRoles(userId: string, mapper: (roles: string[]) => string[]) {
    setRecords((prev) =>
      prev.map((member) => {
        if (member.user_id !== userId) {
          return member;
        }
        const nextRoles = mapper(member.roles);
        return { ...member, roles: sortRoleNames(nextRoles) };
      })
    );
  }

  async function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser || !selectedRole) {
      setStatus({ type: 'error', message: 'Select a staff member and role to assign.' });
      return;
    }

    const actionKey = `assign:${selectedUser}:${selectedRole}`;
    setPendingAction(actionKey);
    setStatus(null);

    try {
      const response = await fetch('/api/admin/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser, role_name: selectedRole })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to assign role.';
        setStatus({ type: 'error', message });
        return;
      }

      const canonicalRole = typeof (payload as any)?.role_name === 'string' ? (payload as any).role_name : selectedRole;

      updateMemberRoles(selectedUser, (rolesList) => {
        const merged = new Set([...rolesList, canonicalRole]);
        return Array.from(merged);
      });

      const targetMember = records.find((member) => member.user_id === selectedUser);
      setStatus({ type: 'success', message: `Assigned ${canonicalRole} to ${describeMember(targetMember)}.` });
    } catch (error) {
      console.error('Failed to assign role', error);
      setStatus({ type: 'error', message: 'Unexpected error assigning role.' });
    } finally {
      setPendingAction(null);
    }
  }

  async function removeRole(userId: string, role: string) {
    const normalised = normaliseRoleName(role);
    if (normalised === 'security_admin') {
      const confirmed = window.confirm(
        'Removing the security_admin role reduces administrator coverage. Are you sure you want to continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    const actionKey = `unassign:${userId}:${role}`;
    setPendingAction(actionKey);
    setStatus(null);

    try {
      const response = await fetch('/api/admin/roles/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_name: role })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to remove role.';
        setStatus({ type: 'error', message });
        return;
      }

      const canonicalRole = typeof (payload as any)?.role_name === 'string' ? (payload as any).role_name : role;

      if ((payload as any)?.removed) {
        updateMemberRoles(userId, (rolesList) =>
          rolesList.filter((entry) => normaliseRoleName(entry) !== normaliseRoleName(canonicalRole))
        );
        const targetMember = records.find((member) => member.user_id === userId);
        setStatus({ type: 'success', message: `Removed ${canonicalRole} from ${describeMember(targetMember)}.` });
      } else {
        const targetMember = records.find((member) => member.user_id === userId);
        setStatus({ type: 'success', message: `${canonicalRole} was not assigned to ${describeMember(targetMember)}.` });
      }
    } catch (error) {
      console.error('Failed to remove role', error);
      setStatus({ type: 'error', message: 'Unexpected error removing role.' });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Role assignments</h1>
          <p className="text-sm text-slate-400">
            Manage privileged roles for Torvus staff. Roles determine access to sensitive console features.
          </p>
        </div>
        <label
          className={clsx(
            'flex w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-within:border-slate-500',
            'lg:w-auto'
          )}
        >
          <span className="sr-only">Filter staff</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by email or name"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </label>
      </div>

      {status ? (
        <div
          role="status"
          className={clsx(
            'rounded-2xl border px-4 py-3 text-sm',
            status.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
          )}
        >
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-800/70">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-400">
                    No staff members match your filter.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.user_id} className="transition hover:bg-slate-800/40">
                    <td className="px-6 py-4 text-sm font-medium text-slate-100">{member.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{member.display_name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {member.roles.length ? (
                          member.roles.map((role) => (
                            <RoleChip
                              key={`${member.user_id}-${role}`}
                              role={role}
                              disabled={pendingAction !== null}
                              onRemove={() => removeRole(member.user_id, role)}
                            />
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Assign role</h2>
            <p className="text-xs text-slate-400">Select a staff member and assign an available role.</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={assignRole}>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span>Staff member</span>
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {records.length === 0 ? (
                  <option value="" disabled>
                    No staff available
                  </option>
                ) : (
                  records.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.display_name ? `${member.display_name} (${member.email})` : member.email}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span>Role</span>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {roles.length === 0 ? (
                  <option value="" disabled>
                    No roles available
                  </option>
                ) : (
                  roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={pendingAction !== null || !selectedUser || !selectedRole}
              className={clsx(
                'inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 focus:ring-offset-slate-950',
                pendingAction !== null && 'cursor-not-allowed opacity-50'
              )}
            >
              Assign role
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
