'use client';

import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

type ApprovalRecord = {
  id: string;
  approver_user_id: string;
  created_at: string;
};

type RequestRecord = {
  id: string;
  key: string;
  env: string;
  action: 'create' | 'rotate' | 'reveal';
  reason: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';
  created_at: string;
  applied_at: string | null;
  approvals: ApprovalRecord[];
};

type SecretApprovalsProps = {
  requests: RequestRecord[];
};

type StatusMessage = { type: 'success' | 'error'; message: string } | null;

function describeAction(action: RequestRecord['action']): string {
  switch (action) {
    case 'create':
      return 'Create secret';
    case 'rotate':
      return 'Rotate secret';
    case 'reveal':
      return 'Reveal secret';
    default:
      return action;
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}

export function SecretApprovals({ requests }: SecretApprovalsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusMessage>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function approveRequest(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    if (pendingId) {
      return;
    }

    setPendingId(requestId);
    setStatus(null);

    try {
      const response = await fetch(`/api/secrets/requests/${requestId}/approve`, {
        method: 'POST'
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to approve request.';
        setStatus({ type: 'error', message });
        return;
      }

      setStatus({ type: 'success', message: 'Approval recorded.' });
      router.refresh();
    } catch (error) {
      console.error('[secrets] approval error', error);
      setStatus({ type: 'error', message: 'Unexpected error approving request.' });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-8 shadow-xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Secret approvals</h1>
        <p className="text-sm text-slate-400">
          Dual-control changes require two distinct administrators. Review pending requests and approve when ready.
        </p>
      </div>

      {status && (
        <div
          className={clsx(
            'rounded-2xl border px-4 py-3 text-sm',
            status.type === 'success'
              ? 'border-emerald-600/60 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-600/60 bg-rose-500/10 text-rose-100'
          )}
        >
          {status.message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800/60 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Secret</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Approvals</th>
              <th className="px-4 py-3 text-left">Requested</th>
              <th className="px-4 py-3 text-right">Approve</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No requests awaiting action.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const isPending = pendingId === request.id;
                const approvalCount = request.approvals.length;
                return (
                  <tr key={request.id} className="transition hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100">{request.key}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">{request.env}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{describeAction(request.action)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <span className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-300">
                        {request.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{request.status}</td>
                    <td className="px-4 py-3 text-slate-300">{approvalCount} / 2</td>
                    <td className="px-4 py-3 text-slate-400">{formatTimestamp(request.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <form onSubmit={(event) => approveRequest(event, request.id)}>
                        <button
                          type="submit"
                          disabled={request.status !== 'pending' || isPending}
                          className={clsx(
                            'rounded-lg px-3 py-1 text-xs font-semibold text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900',
                            request.status === 'pending'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950'
                              : 'bg-slate-800 text-slate-400 cursor-not-allowed',
                            isPending && 'opacity-60'
                          )}
                        >
                          {request.status === 'pending' ? (isPending ? 'Approving…' : 'Approve') : 'Completed'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
