'use client';

import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';

type WebhookRecord = {
  id: string;
  kind: 'slack' | 'teams';
  enabled: boolean;
  description: string | null;
  maskedUrl: string;
  createdAt: string | null;
  secretKey: string | null;
};

type EventRecord = {
  id: string;
  event: string;
  enabled: boolean;
};

type StatusMessage = {
  type: 'success' | 'error';
  message: string;
};

type PendingAction =
  | { type: 'create' }
  | { type: 'toggle-webhook'; id: string }
  | { type: 'delete-webhook'; id: string }
  | { type: 'test-webhook'; id: string }
  | { type: 'toggle-event'; event: string }
  | null;

function describeEvent(event: string): string {
  const parts = event.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (parts.length === 0) {
    return event;
  }
  return parts
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/_/g, ' '))
    .join(' · ');
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

export type IntegrationsManagerProps = {
  initialWebhooks: WebhookRecord[];
  initialEvents: EventRecord[];
};

export function IntegrationsManager({ initialWebhooks, initialEvents }: IntegrationsManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>(initialWebhooks);
  const [events, setEvents] = useState<EventRecord[]>(initialEvents);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [kind, setKind] = useState<'slack' | 'teams'>('slack');
  const [secretKey, setSecretKey] = useState('');
  const [description, setDescription] = useState('');

  const sortedWebhooks = useMemo(() => {
    return [...webhooks].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (a.createdAt) {
        return -1;
      }
      if (b.createdAt) {
        return 1;
      }
      return a.id.localeCompare(b.id);
    });
  }, [webhooks]);

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!secretKey.trim()) {
      setStatus({ type: 'error', message: 'Enter a secret reference key.' });
      return;
    }

    setPending({ type: 'create' });
    setStatus(null);

    try {
      const response = await fetch('/api/admin/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, secretKey: secretKey.trim(), description })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to add webhook.';
        setStatus({ type: 'error', message });
        return;
      }

      setWebhooks((prev) => [payload as WebhookRecord, ...prev]);
      setSecretKey('');
      setDescription('');
      setKind('slack');
      setStatus({ type: 'success', message: 'Webhook added successfully.' });
    } catch (error) {
      console.error('Failed to create webhook', error);
      setStatus({ type: 'error', message: 'Unexpected error adding webhook.' });
    } finally {
      setPending(null);
    }
  }

  async function toggleWebhook(id: string, nextEnabled: boolean) {
    setPending({ type: 'toggle-webhook', id });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to update webhook.';
        setStatus({ type: 'error', message });
        return;
      }

      setWebhooks((prev) => prev.map((record) => (record.id === id ? (payload as WebhookRecord) : record)));
      setStatus({
        type: 'success',
        message: nextEnabled ? 'Webhook enabled.' : 'Webhook disabled.'
      });
    } catch (error) {
      console.error('Failed to toggle webhook', error);
      setStatus({ type: 'error', message: 'Unexpected error updating webhook.' });
    } finally {
      setPending(null);
    }
  }

  async function deleteWebhook(id: string) {
    const confirmed = window.confirm('Remove this webhook? Notifications will no longer be sent to it.');
    if (!confirmed) {
      return;
    }

    setPending({ type: 'delete-webhook', id });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/webhooks/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = (payload as any)?.error ?? 'Failed to delete webhook.';
        setStatus({ type: 'error', message });
        return;
      }

      setWebhooks((prev) => prev.filter((record) => record.id !== id));
      setStatus({ type: 'success', message: 'Webhook removed.' });
    } catch (error) {
      console.error('Failed to delete webhook', error);
      setStatus({ type: 'error', message: 'Unexpected error deleting webhook.' });
    } finally {
      setPending(null);
    }
  }

  async function testWebhook(id: string) {
    setPending({ type: 'test-webhook', id });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/webhooks/${id}/test`, {
        method: 'POST'
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to deliver test notification.';
        setStatus({ type: 'error', message });
        return;
      }

      setStatus({ type: 'success', message: 'Test notification sent.' });
    } catch (error) {
      console.error('Failed to send test notification', error);
      setStatus({ type: 'error', message: 'Unexpected error delivering test notification.' });
    } finally {
      setPending(null);
    }
  }

  async function toggleEvent(eventKey: string, nextEnabled: boolean) {
    setPending({ type: 'toggle-event', event: eventKey });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/events/${encodeURIComponent(eventKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Failed to update event preference.';
        setStatus({ type: 'error', message });
        return;
      }

      setEvents((prev) => prev.map((record) => (record.event === eventKey ? (payload as EventRecord) : record)));
      setStatus({
        type: 'success',
        message: nextEnabled ? 'Event notifications enabled.' : 'Event notifications disabled.'
      });
    } catch (error) {
      console.error('Failed to toggle notification event', error);
      setStatus({ type: 'error', message: 'Unexpected error updating notification preference.' });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="flex flex-col gap-8 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Outbound notifications</h1>
        <p className="text-sm text-slate-400">
          Configure Slack or Teams webhooks and control which events send notifications.
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

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
            <h2 className="text-xl font-semibold text-slate-100">Add webhook</h2>
            <p className="mt-1 text-sm text-slate-400">
              Reference a stored secret key containing the webhook URL. Create or rotate secrets from the Secrets
              admin page.
            </p>
            <form onSubmit={createWebhook} className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Destination</span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as 'slack' | 'teams')}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="slack">Slack</option>
                  <option value="teams">Microsoft Teams</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Secret key</span>
                <input
                  type="text"
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                  placeholder="slack.webhook.prod or slack.webhook@prod"
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Description (optional)</span>
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Security incidents channel"
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={pending?.type === 'create'}
                className={clsx(
                  'inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900',
                  pending?.type === 'create' && 'opacity-60'
                )}
              >
                {pending?.type === 'create' ? 'Adding…' : 'Add webhook'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800/60 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">Destination</th>
                  <th scope="col" className="px-4 py-3 text-left">Secret</th>
                  <th scope="col" className="px-4 py-3 text-left">Created</th>
                  <th scope="col" className="px-4 py-3" colSpan={3}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      No webhooks configured yet.
                    </td>
                  </tr>
                ) : (
                  sortedWebhooks.map((webhook) => {
                    const isToggling = pending?.type === 'toggle-webhook' && pending.id === webhook.id;
                    const isDeleting = pending?.type === 'delete-webhook' && pending.id === webhook.id;
                    const isTesting = pending?.type === 'test-webhook' && pending.id === webhook.id;
                    return (
                      <tr key={webhook.id} className="transition hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-100">
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide text-xs text-slate-400">{webhook.kind}</span>
                            <span>{webhook.description ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          <div className="flex flex-col">
                            <span>{webhook.maskedUrl}</span>
                            <span className="text-xs text-slate-500">{webhook.secretKey ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{formatTimestamp(webhook.createdAt)}</td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleWebhook(webhook.id, !webhook.enabled)}
                            disabled={isToggling}
                            className={clsx(
                              'rounded-lg px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
                              webhook.enabled
                                ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 focus:ring-emerald-400'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-500',
                              isToggling && 'opacity-60'
                            )}
                          >
                            {webhook.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => testWebhook(webhook.id)}
                            disabled={isTesting}
                            className={clsx(
                              'rounded-lg px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900',
                              isTesting && 'opacity-60'
                            )}
                          >
                            {isTesting ? 'Sending…' : 'Send test'}
                          </button>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteWebhook(webhook.id)}
                            disabled={isDeleting}
                            className={clsx(
                              'rounded-lg px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-slate-900',
                              isDeleting && 'opacity-60'
                            )}
                          >
                            {isDeleting ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">Notification events</h2>
          <p className="mt-1 text-sm text-slate-400">
            Toggle which events generate outbound notifications.
          </p>
          <ul className="mt-4 space-y-3">
            {events.length === 0 ? (
              <li className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
                No events registered.
              </li>
            ) : (
              events.map((record) => {
                const isPending = pending?.type === 'toggle-event' && pending.event === record.event;
                return (
                  <li
                    key={record.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{describeEvent(record.event)}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">{record.event}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEvent(record.event, !record.enabled)}
                      disabled={isPending}
                      className={clsx(
                        'rounded-full px-4 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
                        record.enabled
                          ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 focus:ring-emerald-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-500',
                        isPending && 'opacity-60'
                      )}
                    >
                      {record.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
