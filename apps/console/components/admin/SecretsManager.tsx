'use client';

import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

type SecretRecord = {
  key: string;
  env: string;
  version: number;
  lastRotatedAt: string | null;
  lastAccessedAt: string | null;
  requiresDualControl: boolean;
};

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

type StatusMessage = { type: 'success' | 'error'; message: string } | null;

type SecretsManagerProps = {
  secrets: SecretRecord[];
  requests: RequestRecord[];
};

type PendingAction =
  | { type: 'rotate'; secret: SecretRecord }
  | { type: 'reveal'; secret: SecretRecord }
  | null;

type RevealResult =
  | { requestId: string; plaintext: string; key: string; env: string }
  | { requestId: string; masked: string; status: string };

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

function describeAction(action: RequestRecord['action']): string {
  switch (action) {
    case 'create':
      return 'Create';
    case 'rotate':
      return 'Rotate';
    case 'reveal':
      return 'Reveal';
    default:
      return action;
  }
}

export function SecretsManager({ secrets, requests }: SecretsManagerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusMessage>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pending, setPending] = useState(false);
  const [revealPendingId, setRevealPendingId] = useState<string | null>(null);
  const [revealResult, setRevealResult] = useState<RevealResult | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'error'>('idle');

  const [createKey, setCreateKey] = useState('');
  const [createEnv, setCreateEnv] = useState('prod');
  const [createReason, setCreateReason] = useState('');
  const [createPlaintext, setCreatePlaintext] = useState('');
  const [createAad, setCreateAad] = useState('');

  const [actionReason, setActionReason] = useState('');
  const [actionPlaintext, setActionPlaintext] = useState('');
  const [actionAad, setActionAad] = useState('');

  function resetActionForm() {
    setPendingAction(null);
    setActionReason('');
    setActionPlaintext('');
    setActionAad('');
  }

  async function submitCreateSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setStatus(null);

    try {
      const response = await fetch('/api/secrets/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          key: createKey.trim(),
          env: createEnv.trim() || 'prod',
          reason: createReason.trim(),
          plaintext: createPlaintext,
          aad: createAad.trim() || undefined
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to propose secret creation.';
        setStatus({ type: 'error', message });
        return;
      }

      setStatus({ type: 'success', message: 'Secret creation request submitted for approval.' });
      setCreateKey('');
      setCreateEnv('prod');
      setCreateReason('');
      setCreatePlaintext('');
      setCreateAad('');
      router.refresh();
    } catch (error) {
      console.error('[secrets] create proposal failed', error);
      setStatus({ type: 'error', message: 'Unexpected error creating secret.' });
    } finally {
      setPending(false);
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingAction || pending) {
      return;
    }

    setPending(true);
    setStatus(null);

    try {
      const payload: Record<string, unknown> = {
        action: pendingAction.type,
        key: pendingAction.secret.key,
        env: pendingAction.secret.env,
        reason: actionReason.trim()
      };

      if (pendingAction.type === 'rotate') {
        payload.plaintext = actionPlaintext;
        if (actionAad.trim()) {
          payload.aad = actionAad.trim();
        }
      }

      const response = await fetch('/api/secrets/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (json as any)?.error ?? 'Failed to submit request.';
        setStatus({ type: 'error', message });
        return;
      }

      const successMessage =
        pendingAction.type === 'rotate'
          ? 'Rotation request submitted for approval.'
          : 'Reveal request submitted for approval.';
      setStatus({ type: 'success', message: successMessage });
      resetActionForm();
      router.refresh();
    } catch (error) {
      console.error('[secrets] action proposal failed', error);
      setStatus({ type: 'error', message: 'Unexpected error submitting request.' });
    } finally {
      setPending(false);
    }
  }

  async function viewReveal(request: RequestRecord) {
    if (revealPendingId) {
      return;
    }

    setRevealPendingId(request.id);
    setStatus(null);
    setRevealResult(null);
    try {
      const response = await fetch('/api/secrets/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id })
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload && typeof (payload as any).plaintext === 'string') {
        setRevealResult({
          requestId: request.id,
          plaintext: (payload as any).plaintext as string,
          key: (payload as any).key as string,
          env: (payload as any).env as string
        });
        setCopyFeedback('idle');
      } else {
        const masked = (payload as any)?.masked ?? '••••';
        const statusValue = (payload as any)?.status ?? request.status;
        setRevealResult({ requestId: request.id, masked, status: statusValue });
        setStatus({ type: 'error', message: 'Reveal not available. Request may be pending approval or expired.' });
      }
    } catch (error) {
      console.error('[secrets] reveal retrieval failed', error);
      setStatus({ type: 'error', message: 'Unable to retrieve secret reveal.' });
    } finally {
      setRevealPendingId(null);
    }
  }

  async function copyPlaintext() {
    if (!revealResult || !('plaintext' in revealResult)) {
      return;
    }

    try {
      await navigator.clipboard.writeText(revealResult.plaintext);
      setCopyFeedback('copied');
      setTimeout(() => setCopyFeedback('idle'), 2000);
    } catch (error) {
      console.error('[secrets] failed to copy plaintext', error);
      setCopyFeedback('error');
    }
  }

  function acknowledgeReveal() {
    setRevealResult(null);
    setCopyFeedback('idle');
    router.refresh();
    setStatus({ type: 'success', message: 'Secret reveal acknowledged.' });
  }

  return (
    <div className="flex flex-col gap-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-8 shadow-xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Secrets</h1>
        <p className="text-sm text-slate-400">
          Secrets are encrypted and protected by dual-control. Create or rotate secrets by submitting a request that
          requires two administrators to approve.
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

      <section className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Propose new secret</h2>
        <p className="mt-1 text-sm text-slate-400">
          Plaintext is encrypted immediately on submission and requires two approvals before activation.
        </p>
        <form onSubmit={submitCreateSecret} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Secret key</span>
            <input
              required
              value={createKey}
              onChange={(event) => setCreateKey(event.target.value)}
              placeholder="slack.webhook.prod"
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Environment</span>
            <input
              value={createEnv}
              onChange={(event) => setCreateEnv(event.target.value)}
              placeholder="prod"
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-300">
            <span>Reason</span>
            <input
              required
              value={createReason}
              onChange={(event) => setCreateReason(event.target.value)}
              placeholder="Initial Slack webhook configuration"
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-300">
            <span>Plaintext secret</span>
            <textarea
              required
              value={createPlaintext}
              onChange={(event) => setCreatePlaintext(event.target.value)}
              placeholder="Webhook URL or API key"
              rows={4}
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-300">
            <span>Associated data (optional)</span>
            <input
              value={createAad}
              onChange={(event) => setCreateAad(event.target.value)}
              placeholder="Metadata bound via AES-GCM AAD"
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className={clsx(
                'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900',
                pending && 'opacity-60'
              )}
            >
              {pending ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800/60 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                Secret
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Version
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Last rotated
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Last accessed
              </th>
              <th scope="col" className="px-4 py-3 text-right" colSpan={2}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {secrets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No secrets stored yet.
                </td>
              </tr>
            ) : (
              secrets.map((secret) => {
                return (
                  <tr key={`${secret.key}:${secret.env}`} className="transition hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100">{secret.key}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">{secret.env}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{secret.version}</td>
                    <td className="px-4 py-3 text-slate-400">{formatTimestamp(secret.lastRotatedAt)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatTimestamp(secret.lastAccessedAt)}</td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({ type: 'rotate', secret });
                          setActionReason('');
                          setActionPlaintext('');
                          setActionAad('');
                        }}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      >
                        Propose rotation
                      </button>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({ type: 'reveal', secret });
                          setActionReason('');
                          setActionPlaintext('');
                          setActionAad('');
                        }}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      >
                        Propose reveal
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {pendingAction && (
        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {pendingAction.type === 'rotate' ? 'Propose rotation' : 'Propose reveal'} — {pendingAction.secret.key}{' '}
                <span className="text-xs uppercase text-slate-400">({pendingAction.secret.env})</span>
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Provide a reason to notify approvers. Rotation requests must include the new plaintext value.
              </p>
            </div>
            <button
              type="button"
              onClick={resetActionForm}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={submitAction} className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span>Reason</span>
              <input
                required
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Explain why this change is required"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
              />
            </label>
            {pendingAction.type === 'rotate' && (
              <>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>New plaintext secret</span>
                  <textarea
                    required
                    value={actionPlaintext}
                    onChange={(event) => setActionPlaintext(event.target.value)}
                    placeholder="New secret value"
                    rows={4}
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>Associated data (optional)</span>
                  <input
                    value={actionAad}
                    onChange={(event) => setActionAad(event.target.value)}
                    placeholder="AAD value"
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={pending}
                className={clsx(
                  'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900',
                  pending && 'opacity-60'
                )}
              >
                {pending ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800/60 overflow-hidden">
        <h2 className="px-4 pt-4 text-xl font-semibold text-slate-100">Recent requests</h2>
        <table className="mt-4 min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Secret</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Requested</th>
              <th className="px-4 py-3 text-left">Approvals</th>
              <th className="px-4 py-3 text-right">Reveal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  No requests yet.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                return (
                  <tr key={request.id} className="transition hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100">{request.key}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-400">{request.env}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{describeAction(request.action)}</td>
                    <td className="px-4 py-3 text-slate-300">{request.status}</td>
                    <td className="px-4 py-3 text-slate-400">{formatTimestamp(request.created_at)}</td>
                    <td className="px-4 py-3 text-slate-300">{request.approvals.length} / 2</td>
                    <td className="px-4 py-3 text-right">
                      {request.action === 'reveal' ? (
                        <button
                          type="button"
                          onClick={() => viewReveal(request)}
                          disabled={request.status !== 'approved' && request.status !== 'applied'}
                          className={clsx(
                            'rounded-lg px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900',
                            request.status === 'approved' || request.status === 'applied'
                              ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                              : 'bg-slate-800 text-slate-400 cursor-not-allowed',
                            revealPendingId === request.id && 'opacity-60'
                          )}
                        >
                          {request.status === 'approved'
                            ? revealPendingId === request.id
                              ? 'Fetching…'
                              : 'Reveal secret'
                            : request.status === 'applied'
                            ? 'Revealed'
                            : 'Waiting'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {revealResult && 'plaintext' in revealResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-emerald-600/40 bg-slate-900/95 p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-emerald-100">
              Secret revealed — {revealResult.key}
              <span className="ml-2 text-xs uppercase tracking-wide text-emerald-300">{revealResult.env}</span>
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              This secret is only visible for a short period. Copy it to a secure location, then acknowledge once it has
              been stored safely.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-xl border border-slate-700 bg-slate-950/90 p-4 text-sm text-slate-100">
              {revealResult.plaintext}
            </pre>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={copyPlaintext}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {copyFeedback === 'copied'
                  ? 'Copied!'
                  : copyFeedback === 'error'
                  ? 'Copy failed'
                  : 'Copy to clipboard'}
              </button>
              <button
                type="button"
                onClick={acknowledgeReveal}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                I have stored this securely
              </button>
            </div>
          </div>
        </div>
      )}

      {revealResult && 'masked' in revealResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">Reveal unavailable</h3>
            <p className="mt-2 text-sm text-slate-300">
              This reveal request is not currently available. Latest masked value:
            </p>
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
              {revealResult.masked}
            </div>
            <button
              type="button"
              onClick={() => setRevealResult(null)}
              className="mt-4 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
