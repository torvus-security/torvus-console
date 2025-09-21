'use client';

import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';

type IntakeIntegrationRecord = {
  id: string;
  kind: 'generic' | 'statuspage' | 'sentry' | 'posthog';
  name: string;
  enabled: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  maskedSecret: string;
  eventCount: number;
};

type StatusMessage = { type: 'success' | 'error'; message: string } | null;

type PendingState =
  | { type: 'create' }
  | { type: 'toggle'; id: string }
  | { type: 'rotate'; id: string }
  | null;

const HEADER_BY_KIND: Record<IntakeIntegrationRecord['kind'], string> = {
  generic: 'X-Torvus-Signature',
  statuspage: 'X-Statuspage-Signature',
  posthog: 'X-Posthog-Signature',
  sentry: 'Sentry-Hook-Signature'
};

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

function buildCurlExample(
  kind: IntakeIntegrationRecord['kind'],
  name: string,
  secret: string,
  baseUrl: string
): string {
  const safeName = name.trim() || 'integration-name';
  const body = '{"example":"payload"}';
  const endpoint = `${baseUrl}/api/intake/${kind}?name=${encodeURIComponent(safeName)}`;
  const headerName = HEADER_BY_KIND[kind];

  const secretLine = `SECRET="${secret || 'your-shared-secret'}"`;
  const bodyLine = `BODY='${body}'`;
  const secretHashLine =
    "SECRET_HASH=$(printf '%s' \"$SECRET\" | openssl dgst -sha256 -binary | xxd -p -c 64)";

  if (kind === 'sentry') {
    const signatureLine =
      "TIMESTAMP=$(date +%s)\nSIGNATURE=$(printf '%s' \"$TIMESTAMP.$BODY\" | openssl dgst -sha256 -mac HMAC -macopt hexkey:$SECRET_HASH | awk '{print $2}')";
    return [
      secretLine,
      bodyLine,
      secretHashLine,
      signatureLine,
      `curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H "Sentry-Hook-Timestamp: $TIMESTAMP" \\
  -H "${headerName}: t=$TIMESTAMP,v1=$SIGNATURE" \\
  -d "$BODY"`
    ].join('\n');
  }

  const signatureLine =
    "SIGNATURE=$(printf '%s' \"$BODY\" | openssl dgst -sha256 -mac HMAC -macopt hexkey:$SECRET_HASH | awk '{print $2}')";

  return [
    secretLine,
    bodyLine,
    secretHashLine,
    signatureLine,
    `curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H '${headerName}: sha256=$SIGNATURE' \\
  -d "$BODY"`
  ].join('\n');
}

export type IntakeIntegrationsManagerProps = {
  initialIntegrations: IntakeIntegrationRecord[];
  intakeBaseUrl: string;
};

export function IntakeIntegrationsManager({
  initialIntegrations,
  intakeBaseUrl
}: IntakeIntegrationsManagerProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [kind, setKind] = useState<IntakeIntegrationRecord['kind']>('generic');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<StatusMessage>(null);
  const [pending, setPending] = useState<PendingState>(null);

  const example = useMemo(() => buildCurlExample(kind, name, secret, intakeBaseUrl), [kind, name, secret, intakeBaseUrl]);

  const sortedIntegrations = useMemo(() => {
    return [...integrations].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (a.createdAt) {
        return -1;
      }
      if (b.createdAt) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [integrations]);

  async function createIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setStatus({ type: 'error', message: 'Enter a name for the integration.' });
      return;
    }
    if (secret.trim().length < 8) {
      setStatus({ type: 'error', message: 'Secret must be at least 8 characters.' });
      return;
    }

    setPending({ type: 'create' });
    setStatus(null);

    try {
      const response = await fetch('/api/admin/integrations/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, secret })
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      if (!response.ok) {
        const message = (payload as any)?.error ?? (typeof payload === 'string' ? payload : 'Failed to create integration.');
        setStatus({ type: 'error', message: typeof message === 'string' ? message : 'Failed to create integration.' });
        return;
      }

      setIntegrations((prev) => [payload as IntakeIntegrationRecord, ...prev]);
      setName('');
      setSecret('');
      setKind('generic');
      setStatus({ type: 'success', message: 'Integration created successfully.' });
    } catch (error) {
      console.error('Failed to create intake integration', error);
      setStatus({ type: 'error', message: 'Unexpected error creating integration.' });
    } finally {
      setPending(null);
    }
  }

  async function toggleIntegration(id: string, enabled: boolean) {
    setPending({ type: 'toggle', id });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/intake/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      if (!response.ok) {
        const message = (payload as any)?.error ?? (typeof payload === 'string' ? payload : 'Failed to update integration.');
        setStatus({ type: 'error', message });
        return;
      }

      setIntegrations((prev) => prev.map((item) => (item.id === id ? (payload as IntakeIntegrationRecord) : item)));
      setStatus({ type: 'success', message: enabled ? 'Integration enabled.' : 'Integration disabled.' });
    } catch (error) {
      console.error('Failed to toggle intake integration', error);
      setStatus({ type: 'error', message: 'Unexpected error updating integration.' });
    } finally {
      setPending(null);
    }
  }

  async function rotateIntegration(id: string) {
    const newSecret = window.prompt('Enter a new shared secret (min 8 characters):');
    if (!newSecret) {
      return;
    }
    if (newSecret.trim().length < 8) {
      setStatus({ type: 'error', message: 'Secret must be at least 8 characters.' });
      return;
    }

    setPending({ type: 'rotate', id });
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/integrations/intake/${id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: newSecret })
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      if (!response.ok) {
        const message = (payload as any)?.error ?? (typeof payload === 'string' ? payload : 'Failed to rotate secret.');
        setStatus({ type: 'error', message });
        return;
      }

      setIntegrations((prev) => prev.map((item) => (item.id === id ? (payload as IntakeIntegrationRecord) : item)));
      setStatus({ type: 'success', message: 'Secret rotated successfully.' });
    } catch (error) {
      console.error('Failed to rotate intake secret', error);
      setStatus({ type: 'error', message: 'Unexpected error rotating secret.' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card">
      <h2>Intake Webhooks</h2>
      <p className="muted">Register inbound integrations and generate signed webhook examples.</p>

      <form className="form" onSubmit={createIntegration}>
        <div className="field-row">
          <label>
            Kind
            <select value={kind} onChange={(event) => setKind(event.target.value as IntakeIntegrationRecord['kind'])}>
              <option value="generic">Generic</option>
              <option value="statuspage">Statuspage</option>
              <option value="sentry">Sentry</option>
              <option value="posthog">PostHog</option>
            </select>
          </label>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="production" required />
          </label>
          <label>
            Shared secret
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </label>
        </div>
        <button type="submit" className="button" disabled={pending?.type === 'create'}>
          {pending?.type === 'create' ? 'Creating…' : 'Create integration'}
        </button>
      </form>

      <div className="code-snippet">
        <div className="code-snippet__header">cURL example</div>
        <pre>
          <code>{example}</code>
        </pre>
      </div>

      {status && <div className={clsx('status', status.type)}>{status.message}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Integration</th>
            <th>Events</th>
            <th>Last seen</th>
            <th>Secret</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedIntegrations.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty">
                No intake integrations yet.
              </td>
            </tr>
          ) : (
            sortedIntegrations.map((integration) => {
              const isToggling = pending?.type === 'toggle' && pending.id === integration.id;
              const isRotating = pending?.type === 'rotate' && pending.id === integration.id;
              return (
                <tr key={integration.id}>
                  <td>
                    <div className="item-primary">{integration.name}</div>
                    <div className="item-secondary">{integration.kind}</div>
                  </td>
                  <td>{integration.eventCount}</td>
                  <td>
                    <div className="item-primary">{formatTimestamp(integration.lastSeenAt)}</div>
                    <div className="item-secondary">Created {formatTimestamp(integration.createdAt)}</div>
                  </td>
                  <td>{integration.maskedSecret}</td>
                  <td>
                    <span className={clsx('badge', integration.enabled ? 'badge--success' : 'badge--muted')}>
                      {integration.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="link"
                        disabled={isRotating}
                        onClick={() => rotateIntegration(integration.id)}
                      >
                        Rotate secret
                      </button>
                      <button
                        type="button"
                        className="link"
                        disabled={isToggling}
                        onClick={() => toggleIntegration(integration.id, !integration.enabled)}
                      >
                        {integration.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
