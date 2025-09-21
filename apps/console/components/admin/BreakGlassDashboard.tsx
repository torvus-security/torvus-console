'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';

type StaffDirectoryEntry = {
  userId: string;
  email: string;
  displayName: string | null;
};

type RoleOption = {
  name: string;
  description?: string | null;
};

type RequestRecord = {
  id: string;
  createdAt: string;
  requestedBy: string;
  targetUserId: string;
  roles: string[];
  reason: string;
  ticketUrl: string | null;
  windowMinutes: number;
  status: string;
  executedAt: string | null;
  approvals: number;
};

type ToastMessage = {
  id: number;
  type: 'success' | 'error';
  message: string;
};

type RequestFormProps = {
  staff: StaffDirectoryEntry[];
  roles: RoleOption[];
  canSubmit: boolean;
  onCreated: () => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
};

type PendingListProps = {
  staff: StaffDirectoryEntry[];
  refreshToken: number;
  canApprove: boolean;
  currentUserId: string;
  onChanged: () => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
};

type ExecutedListProps = {
  staff: StaffDirectoryEntry[];
  refreshToken: number;
  canRevoke: boolean;
  onChanged: () => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
};

type BreakGlassDashboardProps = {
  staff: StaffDirectoryEntry[];
  roles: RoleOption[];
  canRequest: boolean;
  canApprove: boolean;
  currentUserId: string;
};

function describeStaff(staff: StaffDirectoryEntry | undefined): string {
  if (!staff) {
    return 'Unknown user';
  }

  if (staff.displayName) {
    return `${staff.displayName} (${staff.email})`;
  }

  return staff.email;
}

function RequestForm({ staff, roles, canSubmit, onCreated, showToast }: RequestFormProps) {
  const [targetUserId, setTargetUserId] = useState<string>(() => staff[0]?.userId ?? '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() =>
    roles.length > 0 ? [roles[0].name] : []
  );
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [reason, setReason] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<ToastMessage | null>(null);

  useEffect(() => {
    setTargetUserId((current) => {
      if (current && staff.some((entry) => entry.userId === current)) {
        return current;
      }
      return staff[0]?.userId ?? '';
    });
  }, [staff]);

  useEffect(() => {
    setSelectedRoles((current) => {
      if (current.length === 0 && roles.length > 0) {
        return [roles[0].name];
      }
      const existing = current.filter((role) => roles.some((option) => option.name === role));
      if (existing.length > 0) {
        return existing;
      }
      return roles.length > 0 ? [roles[0].name] : [];
    });
  }, [roles]);

  function toggleRole(role: string) {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((item) => item !== role);
      }
      return [...prev, role];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setStatus({ id: Date.now(), type: 'error', message: 'You are not permitted to raise break-glass requests.' });
      return;
    }

    if (!targetUserId) {
      setStatus({ id: Date.now(), type: 'error', message: 'Select a target user.' });
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setStatus({ id: Date.now(), type: 'error', message: 'Provide a reason for the elevation.' });
      return;
    }

    if (selectedRoles.length === 0) {
      setStatus({ id: Date.now(), type: 'error', message: 'Choose at least one role.' });
      return;
    }

    setPending(true);
    setStatus(null);

    try {
      const response = await fetch('/api/breakglass/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          roles: selectedRoles,
          reason: trimmedReason,
          ticket_url: ticketUrl.trim() || undefined,
          window_minutes: windowMinutes
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = (payload as any)?.error ?? 'Failed to create request.';
        setStatus({ id: Date.now(), type: 'error', message });
        showToast('error', message);
        return;
      }

      setReason('');
      setTicketUrl('');
      showToast('success', 'Break-glass request submitted for dual approval.');
      onCreated();
    } catch (error) {
      console.error('Failed to submit break-glass request', error);
      const message = 'Unexpected error creating request.';
      setStatus({ id: Date.now(), type: 'error', message });
      showToast('error', message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="breakglass-form-heading">
      <div className="panel__header">
        <div>
          <h2 id="breakglass-form-heading" className="text-lg font-semibold">
            Raise break-glass request
          </h2>
          <p className="muted">Dual-control elevation grants roles for a limited window.</p>
        </div>
      </div>

      {status && (
        <div
          role="status"
          className={clsx(
            'mb-4 rounded-md border px-3 py-2 text-sm',
            status.type === 'success'
              ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
          )}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
          Target staff member
          <select
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            disabled={!canSubmit || pending}
            className="rounded border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-base text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            {staff.length === 0 && <option value="">No staff records</option>}
            {staff.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {describeStaff(entry)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium uppercase tracking-wide text-slate-300">
            Roles to grant
          </legend>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => {
              const checked = selectedRoles.includes(role.name);
              return (
                <label
                  key={role.name}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm',
                    checked
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-600/60 bg-slate-800/40 text-slate-200'
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    disabled={!canSubmit || pending}
                    onChange={() => toggleRole(role.name)}
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold">{role.name}</span>
                    {role.description && (
                      <span className="text-xs text-slate-400">{role.description}</span>
                    )}
                  </span>
                </label>
              );
            })}
            {roles.length === 0 && <span className="text-sm text-slate-400">No roles available.</span>}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
          Duration window (minutes)
          <select
            value={windowMinutes}
            onChange={(event) => setWindowMinutes(Number(event.target.value))}
            disabled={!canSubmit || pending}
            className="rounded border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-base text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            {[15, 30, 60, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!canSubmit || pending}
            rows={3}
            className="rounded border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-base text-slate-100 focus:border-emerald-400 focus:outline-none"
            placeholder="Describe why elevated access is required"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
          Ticket URL (optional)
          <input
            type="url"
            value={ticketUrl}
            onChange={(event) => setTicketUrl(event.target.value)}
            disabled={!canSubmit || pending}
            className="rounded border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-base text-slate-100 focus:border-emerald-400 focus:outline-none"
            placeholder="https://..."
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            Requests require two distinct security administrators before execution.
          </p>
          <button
            type="submit"
            className={clsx('button primary', pending && 'opacity-70')}
            disabled={!canSubmit || pending}
          >
            {pending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </section>
  );
}

function useStaffLookup(staff: StaffDirectoryEntry[]) {
  return useMemo(() => {
    const map = new Map<string, StaffDirectoryEntry>();
    for (const entry of staff) {
      map.set(entry.userId, entry);
    }
    return map;
  }, [staff]);
}

async function fetchRequests(status: string): Promise<RequestRecord[]> {
  const response = await fetch(`/api/breakglass/requests?status=${encodeURIComponent(status)}`, {
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (payload as any)?.error ?? 'Failed to load requests.';
    throw new Error(message);
  }

  const rows = Array.isArray((payload as any)?.requests) ? (payload as any).requests : [];

  return rows.map((row) => ({
    id: String(row.id ?? ''),
    createdAt: String(row.created_at ?? ''),
    requestedBy: String(row.requested_by ?? ''),
    targetUserId: String(row.target_user_id ?? ''),
    roles: Array.isArray(row.roles) ? row.roles.map((role: unknown) => String(role)) : [],
    reason: String(row.reason ?? ''),
    ticketUrl: row.ticket_url ? String(row.ticket_url) : null,
    windowMinutes: Number(row.window_minutes ?? 60),
    status: String(row.status ?? ''),
    executedAt: row.executed_at ? String(row.executed_at) : null,
    approvals: Number(row.approvals ?? 0)
  }));
}

function PendingList({ staff, refreshToken, canApprove, currentUserId, onChanged, showToast }: PendingListProps) {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const staffLookup = useStaffLookup(staff);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRequests('pending')
      .then((records) => {
        if (!cancelled) {
          setRequests(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load pending requests', err);
          setError(err instanceof Error ? err.message : 'Failed to load requests.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function approveRequest(requestId: string) {
    if (!canApprove) {
      return;
    }

    const confirmed = window.confirm("Dual control: you can’t approve your own request. Continue?");
    if (!confirmed) {
      return;
    }

    setPendingActionId(requestId);

    try {
      const response = await fetch(`/api/breakglass/requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = (payload as any)?.error ?? 'Unable to record approval.';
        showToast('error', message);
        return;
      }

      showToast('success', 'Approval captured. Awaiting quorum.');
      onChanged();
    } catch (error) {
      console.error('Failed to approve request', error);
      showToast('error', 'Unexpected error approving request.');
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="pending-requests-heading">
      <div className="panel__header">
        <h2 id="pending-requests-heading" className="text-lg font-semibold">
          Pending approvals
        </h2>
        <span className="tag subtle">Awaiting dual control</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Requested</th>
              <th>Requester</th>
              <th>Target</th>
              <th>Roles</th>
              <th>Reason</th>
              <th>Approvals</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">
                  Loading pending requests…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={7} className="empty">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && requests.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No pending break-glass requests.
                </td>
              </tr>
            )}
            {!loading && !error &&
              requests.map((request) => {
                const requester = staffLookup.get(request.requestedBy);
                const target = staffLookup.get(request.targetUserId);
                const disableApproval = !canApprove || request.requestedBy === currentUserId;
                return (
                  <tr key={request.id}>
                    <td>{new Date(request.createdAt).toLocaleString()}</td>
                    <td>{describeStaff(requester)}</td>
                    <td>{describeStaff(target)}</td>
                    <td>{request.roles.join(', ') || '—'}</td>
                    <td className="max-w-xs break-words text-sm text-slate-200">{request.reason}</td>
                    <td>
                      <span className="tag subtle">{request.approvals} / 2</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {request.ticketUrl && (
                          <a
                            href={request.ticketUrl}
                            className="text-sm text-emerald-300 underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ticket
                          </a>
                        )}
                        <button
                          type="button"
                          className="button small"
                          onClick={() => approveRequest(request.id)}
                          disabled={disableApproval || pendingActionId === request.id}
                        >
                          {pendingActionId === request.id ? 'Approving…' : 'Approve'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDuration(msRemaining: number): { label: string; expired: boolean } {
  if (!Number.isFinite(msRemaining)) {
    return { label: 'Unknown', expired: true };
  }
  if (msRemaining <= 0) {
    return { label: 'Expired', expired: true };
  }

  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}m`);
  }
  parts.push(`${seconds.toString().padStart(2, '0')}s`);

  return { label: parts.join(' '), expired: false };
}

function CountdownChip({ executedAt, windowMinutes }: { executedAt: string | null; windowMinutes: number }) {
  const [remaining, setRemaining] = useState(() => {
    if (!executedAt) {
      return Number.NaN;
    }
    const executedTime = new Date(executedAt).getTime();
    return executedTime + windowMinutes * 60_000 - Date.now();
  });

  useEffect(() => {
    if (!executedAt) {
      return;
    }

    const executedTime = new Date(executedAt).getTime();

    function update() {
      setRemaining(executedTime + windowMinutes * 60_000 - Date.now());
    }

    update();
    const id = window.setInterval(update, 1_000);
    return () => window.clearInterval(id);
  }, [executedAt, windowMinutes]);

  const { label, expired } = formatDuration(remaining);
  const tagClass = expired ? 'tag danger' : 'tag';

  return <span className={tagClass}>{label}</span>;
}

function ExecutedList({ staff, refreshToken, canRevoke, onChanged, showToast }: ExecutedListProps) {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const staffLookup = useStaffLookup(staff);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRequests('executed')
      .then((records) => {
        if (!cancelled) {
          setRequests(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load executed requests', err);
          setError(err instanceof Error ? err.message : 'Failed to load requests.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function revoke(requestId: string) {
    if (!canRevoke) {
      return;
    }

    const confirmed = window.confirm('Revoke elevated access early? Active sessions may lose access immediately.');
    if (!confirmed) {
      return;
    }

    setPendingActionId(requestId);

    try {
      const response = await fetch(`/api/breakglass/requests/${encodeURIComponent(requestId)}/revoke`, {
        method: 'POST'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = (payload as any)?.error ?? 'Unable to revoke request.';
        showToast('error', message);
        return;
      }

      showToast('success', 'Elevation revoked.');
      onChanged();
    } catch (error) {
      console.error('Failed to revoke request', error);
      showToast('error', 'Unexpected error revoking request.');
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="executed-requests-heading">
      <div className="panel__header">
        <h2 id="executed-requests-heading" className="text-lg font-semibold">
          Active elevations
        </h2>
        <span className="tag subtle">Time boxed</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Executed</th>
              <th>Target</th>
              <th>Roles</th>
              <th>Reason</th>
              <th>Window</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="empty">
                  Loading active elevations…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="empty">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && requests.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No active break-glass elevations.
                </td>
              </tr>
            )}
            {!loading && !error &&
              requests.map((request) => {
                const target = staffLookup.get(request.targetUserId);
                return (
                  <tr key={request.id}>
                    <td>{request.executedAt ? new Date(request.executedAt).toLocaleString() : '—'}</td>
                    <td>{describeStaff(target)}</td>
                    <td>{request.roles.join(', ') || '—'}</td>
                    <td className="max-w-xs break-words text-sm text-slate-200">{request.reason}</td>
                    <td>
                      <CountdownChip executedAt={request.executedAt} windowMinutes={request.windowMinutes} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {request.ticketUrl && (
                          <a
                            href={request.ticketUrl}
                            className="text-sm text-emerald-300 underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ticket
                          </a>
                        )}
                        <button
                          type="button"
                          className="button small ghost"
                          onClick={() => revoke(request.id)}
                          disabled={!canRevoke || pendingActionId === request.id}
                        >
                          {pendingActionId === request.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BreakGlassDashboard({ staff, roles, canRequest, canApprove, currentUserId }: BreakGlassDashboardProps) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  return (
    <div className="page">
      <div className="fixed right-8 top-8 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'min-w-[240px] rounded-md border px-4 py-3 text-sm shadow-lg backdrop-blur',
              toast.type === 'success'
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                : 'border-rose-500/60 bg-rose-500/20 text-rose-100'
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <RequestForm
        staff={staff}
        roles={roles}
        canSubmit={canRequest}
        onCreated={triggerRefresh}
        showToast={showToast}
      />

      <PendingList
        staff={staff}
        refreshToken={refreshToken}
        canApprove={canApprove}
        currentUserId={currentUserId}
        onChanged={triggerRefresh}
        showToast={showToast}
      />

      <ExecutedList
        staff={staff}
        refreshToken={refreshToken}
        canRevoke={canApprove}
        onChanged={triggerRefresh}
        showToast={showToast}
      />
    </div>
  );
}

export type { StaffDirectoryEntry, RoleOption };
