'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from 'react';
import { Button, Callout, Flex } from '@radix-ui/themes';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonBlock } from '../../components/SkeletonBlock';

export type PersonalAccessToken = {
  id: string;
  user_id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
};

const SCOPE_LABELS: Record<string, string> = {
  read: 'Read',
  write: 'Write'
};

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function buildExpiryPayload(value: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Date inputs return YYYY-MM-DD; normalise to midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`).toISOString();
  }

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function TokenSecretBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('failed to copy personal access token', error);
    }
  }, [secret]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Copy this token now</span>
        <span className="text-sm text-amber-200/80">
          This secret will only be shown once. Store it securely in your password manager.
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between">
        <code className="truncate font-mono text-xs sm:text-sm">{secret}</code>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-amber-400/40 bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-300/30"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:text-amber-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopesList({ scopes }: { scopes: string[] }) {
  const uniqueScopes = useMemo(() => Array.from(new Set(scopes)), [scopes]);

  if (!uniqueScopes.length) {
    return <span className="text-xs text-slate-400">Default (read, write)</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {uniqueScopes.map((scope) => (
        <span
          key={scope}
          className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/70 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-200"
        >
          {SCOPE_LABELS[scope] ?? scope}
        </span>
      ))}
    </div>
  );
}

export type PersonalAccessTokensPanelHandle = {
  openCreate: () => void;
  reload: () => void;
};

export type PersonalAccessTokensPanelProps = {
  showHeader?: boolean;
};

export const PersonalAccessTokensPanel = forwardRef<
  PersonalAccessTokensPanelHandle,
  PersonalAccessTokensPanelProps
>(function PersonalAccessTokensPanel({ showHeader = true }, ref) {
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopeRead, setScopeRead] = useState(true);
  const [scopeWrite, setScopeWrite] = useState(true);
  const [expiry, setExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/self/pats', { cache: 'no-store' });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'failed to load tokens');
      }
      const data = (await response.json()) as PersonalAccessToken[];
      if (mountedRef.current) {
        setTokens(data);
      }
    } catch (loadError) {
      console.error('failed to load personal access tokens', loadError);
      if (mountedRef.current) {
        setError('Unable to load personal access tokens. Try again in a moment.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadTokens();

    return () => {
      mountedRef.current = false;
    };
  }, [loadTokens]);

  const resetForm = useCallback(() => {
    setName('');
    setScopeRead(true);
    setScopeWrite(true);
    setExpiry('');
    setCreationError(null);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setModalOpen(true);
    setCreationError(null);
  }, [resetForm]);

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (creating) {
        return;
      }

      setCreating(true);
      setCreationError(null);

      const selectedScopes: string[] = [];
      if (scopeRead) {
        selectedScopes.push('read');
      }
      if (scopeWrite) {
        selectedScopes.push('write');
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setCreationError('Name is required.');
        setCreating(false);
        return;
      }

      const payload: Record<string, unknown> = {
        name: trimmedName
      };

      if (selectedScopes.length && selectedScopes.length < 2) {
        payload.scopes = selectedScopes;
      } else if (!selectedScopes.length) {
        payload.scopes = [];
      }

      const expiresPayload = buildExpiryPayload(expiry);
      if (expiry && !expiresPayload) {
        setCreationError('Expiry date is invalid.');
        setCreating(false);
        return;
      }

      if (expiresPayload) {
        payload.expires_at = expiresPayload;
      }

      try {
        const response = await fetch('/api/self/pats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'failed to create token');
        }

        const result = (await response.json()) as { token: string; row: PersonalAccessToken };
        setTokens((previous) => [result.row, ...previous.filter((token) => token.id !== result.row.id)]);
        setSecret(result.token);
        setModalOpen(false);
        resetForm();
      } catch (createError) {
        console.error('failed to create personal access token', createError);
        setCreationError(
          createError instanceof Error
            ? createError.message
            : 'Unable to create token. Please try again.'
        );
      } finally {
        setCreating(false);
      }
    },
    [creating, expiry, name, resetForm, scopeRead, scopeWrite]
  );

  const handleRevoke = useCallback(async (id: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/self/pats/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'failed to revoke token');
      }
      const row = (await response.json()) as PersonalAccessToken;
      setTokens((previous) => previous.map((token) => (token.id === row.id ? row : token)));
    } catch (revokeError) {
      console.error('failed to revoke personal access token', revokeError);
      setError('Unable to revoke token. Try again in a moment.');
    }
  }, []);

  const closeModal = useCallback(() => {
    if (!creating) {
      setModalOpen(false);
      resetForm();
    }
  }, [creating, resetForm]);

  const dismissSecret = useCallback(() => {
    setSecret(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openCreate,
      reload: () => {
        void loadTokens();
      }
    }),
    [loadTokens, openCreate]
  );

  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tokens]);

  return (
    <section
      className="flex flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {showHeader ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-slate-100">Personal access tokens</h2>
            <p className="text-sm text-slate-400">
              Generate secrets for CLI or API access. Tokens inherit your current roles and can be revoked at any time.
            </p>
          </div>
          <Button color="iris" onClick={openCreate} className="mt-2 sm:mt-0">
            Create token
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {secret ? <TokenSecretBanner secret={secret} onDismiss={dismissSecret} /> : null}
        {error ? (
          <Callout.Root color="crimson" role="alert">
            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Callout.Text>{error}</Callout.Text>
              <Button color="crimson" variant="soft" onClick={() => void loadTokens()}>
                Retry
              </Button>
            </Flex>
          </Callout.Root>
        ) : null}
        {loading ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-6" aria-hidden="true">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                  <SkeletonBlock width="12rem" height="1rem" />
                  <SkeletonBlock width="16rem" height="0.75rem" />
                  <SkeletonBlock width="8rem" height="0.75rem" />
                </div>
              ))}
            </div>
          </div>
        ) : sortedTokens.length === 0 ? (
          <EmptyState
            title="No personal access tokens"
            description="Create a token to generate API credentials tied to your account."
            action={
              <Button color="iris" onClick={openCreate}>
                Create token
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTokens.map((token) => (
              <div
                key={token.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{token.name}</span>
                    {token.revoked ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-200">
                        Revoked
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2 sm:text-sm">
                    <span>
                      Created <strong className="font-medium text-slate-200">{formatDate(token.created_at)}</strong>
                    </span>
                    <span>
                      Last used{' '}
                      <strong className="font-medium text-slate-200">{formatDate(token.last_used_at)}</strong>
                    </span>
                    <span>
                      Expires{' '}
                      <strong className="font-medium text-slate-200">{token.expires_at ? formatDate(token.expires_at) : 'Never'}</strong>
                    </span>
                    <ScopesList scopes={token.scopes} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRevoke(token.id)}
                    disabled={token.revoked}
                    className="inline-flex items-center justify-center rounded-full border border-slate-600/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {token.revoked ? 'Revoked' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-slate-100">Create personal access token</h3>
                <p className="text-sm text-slate-400">
                  Tokens are scoped to your account. Store the generated secret securely — it cannot be recovered later.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span className="font-semibold">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  required
                  placeholder="CLI on Hayden’s MacBook Air"
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40"
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold text-slate-200">Scopes</legend>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={scopeRead}
                    onChange={(event) => setScopeRead(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-400"
                  />
                  <span>Read</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={scopeWrite}
                    onChange={(event) => setScopeWrite(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-400"
                  />
                  <span>Write</span>
                </label>
                <p className="text-xs text-slate-500">Leave both selected for full access.</p>
              </fieldset>

              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span className="font-semibold">Expiry (optional)</span>
                <input
                  type="date"
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40"
                />
                <span className="text-xs text-slate-500">Token will expire at 00:00 UTC on the selected date.</span>
              </label>

              {creationError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{creationError}</div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-600/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? 'Creating…' : 'Create token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
});
