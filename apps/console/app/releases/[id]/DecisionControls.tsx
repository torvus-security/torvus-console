'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Decision = 'approve' | 'reject';

type DecisionControlsProps = {
  requestId: string;
};

export function DecisionControls({ requestId }: DecisionControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitDecision(decision: Decision) {
    if (submitting) return;
    setSubmitting(decision);
    setError(null);

    try {
      const response = await fetch(`/api/releases/${requestId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() || undefined })
      });

      if (!response.ok) {
        const message = response.status === 409 ? 'This request already has a decision recorded.' : 'Failed to submit decision.';
        setError(message);
        setSubmitting(null);
        return;
      }

      await response.json();
      setReason('');
      setSubmitting(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to submit decision', err);
      setError('Failed to submit decision.');
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div>
        <label htmlFor="decision-reason" className="block text-sm font-medium text-slate-200">
          Reason (optional)
        </label>
        <textarea
          id="decision-reason"
          name="decision-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
          placeholder="Add context for your decision"
        />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submitDecision('approve')}
          disabled={submitting !== null}
          className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => submitDecision('reject')}
          disabled={submitting !== null}
          className="inline-flex items-center rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-rose-950 transition hover:bg-rose-400 disabled:opacity-60"
        >
          {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
