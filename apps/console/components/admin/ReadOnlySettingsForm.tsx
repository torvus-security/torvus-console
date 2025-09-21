'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type ReadOnlySettings = {
  enabled: boolean;
  message: string;
  allow_roles: string[];
};

type ReadOnlySettingsFormProps = {
  initialState: ReadOnlySettings;
  availableRoles: string[];
};

type SubmissionState = 'idle' | 'saving' | 'success' | 'error';

function normaliseRoles(input: string[]): string[] {
  const unique = new Set<string>();
  for (const role of input) {
    if (typeof role !== 'string') {
      continue;
    }
    const trimmed = role.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed);
  }

  if (![...unique].some((role) => role.toLowerCase() === 'security_admin')) {
    unique.add('security_admin');
  }

  return Array.from(unique);
}

export function ReadOnlySettingsForm({ initialState, availableRoles }: ReadOnlySettingsFormProps) {
  const [draftEnabled, setDraftEnabled] = useState<boolean>(initialState.enabled);
  const [draftMessage, setDraftMessage] = useState<string>(initialState.message);
  const [draftAllowRoles, setDraftAllowRoles] = useState<string[]>(() => normaliseRoles(initialState.allow_roles));
  const [baseline, setBaseline] = useState<ReadOnlySettings>(initialState);
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const sortedRoles = useMemo(() => {
    const normalised = Array.from(new Set(availableRoles.map((role) => role.trim()).filter(Boolean)));
    if (!normalised.includes('security_admin')) {
      normalised.push('security_admin');
    }
    normalised.sort((a, b) => a.localeCompare(b));
    return normalised;
  }, [availableRoles]);

  const hasChanges = useMemo(() => {
    const baselineRoles = new Set((baseline.allow_roles ?? []).map((role) => role.trim()));
    const draftRoles = new Set(draftAllowRoles.map((role) => role.trim()));
    if (baselineRoles.size !== draftRoles.size) {
      return true;
    }
    for (const role of baselineRoles) {
      if (!draftRoles.has(role)) {
        return true;
      }
    }
    return baseline.enabled !== draftEnabled || baseline.message !== draftMessage;
  }, [baseline, draftAllowRoles, draftEnabled, draftMessage]);

  const toggleRole = (role: string, checked: boolean) => {
    setDraftAllowRoles((current) => {
      const roles = new Set(current);
      if (checked) {
        roles.add(role);
      } else if (role.toLowerCase() !== 'security_admin') {
        roles.delete(role);
      }
      return normaliseRoles(Array.from(roles));
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || status === 'saving') {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowConfirm(true);
  };

  const commitChanges = async () => {
    setStatus('saving');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/settings/read-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: draftEnabled,
          message: draftMessage,
          allow_roles: draftAllowRoles
        })
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || 'Failed to update read-only settings');
      }

      const result = (await response.json()) as { read_only: ReadOnlySettings };
      const updated = result.read_only;

      setBaseline(updated);
      setDraftAllowRoles(normaliseRoles(updated.allow_roles));
      setDraftMessage(updated.message);
      setDraftEnabled(updated.enabled);
      setStatus('success');
      setSuccessMessage(updated.enabled ? 'Read-only mode enabled.' : 'Read-only mode disabled.');
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      setErrorMessage(message);
    } finally {
      setShowConfirm(false);
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  const cancelConfirm = () => {
    if (status === 'saving') {
      return;
    }
    setShowConfirm(false);
  };

  return (
    <form className="read-only-settings" onSubmit={onSubmit}>
      <header className="read-only-settings__header">
        <div>
          <h1>Read-only mode</h1>
          <p>Temporarily pause mutating actions across the console while maintenance or investigations are underway.</p>
        </div>
        <label className="read-only-toggle">
          <input
            type="checkbox"
            checked={draftEnabled}
            onChange={(event) => setDraftEnabled(event.target.checked)}
          />
          <span className="read-only-toggle__label">{draftEnabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </header>

      <div className="read-only-settings__grid">
        <label className="field">
          <span className="field__label">Banner message</span>
          <textarea
            value={draftMessage}
            maxLength={200}
            onChange={(event) => setDraftMessage(event.target.value)}
            rows={3}
            required
          />
          <span className="field__help">Displayed across the console while read-only mode is active.</span>
        </label>

        <div className="field">
          <span className="field__label">Allow these roles to bypass</span>
          <div className="role-list">
            {sortedRoles.map((role) => {
              const lower = role.toLowerCase();
              const isSecurityAdmin = lower === 'security_admin';
              const checked = draftAllowRoles.some((value) => value.toLowerCase() === lower);
              return (
                <label key={role} className="role-list__item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleRole(role, event.target.checked)}
                    disabled={isSecurityAdmin}
                  />
                  <span>{role}</span>
                  {isSecurityAdmin ? <span className="role-list__hint">Required</span> : null}
                </label>
              );
            })}
          </div>
          <span className="field__help">Selected roles may continue to perform critical operations.</span>
        </div>
      </div>

      {errorMessage ? <div className="alert alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="alert alert--success">{successMessage}</div> : null}

      <footer className="read-only-settings__footer">
        <button type="submit" className="button" disabled={!hasChanges || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </footer>

      {showConfirm ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-read-only-title">
            <h2 id="confirm-read-only-title">Confirm update</h2>
            <p>
              {draftEnabled
                ? 'Enable read-only mode and block write operations for non-privileged users?'
                : 'Disable read-only mode and restore normal operations?'}
            </p>
            <div className="modal__actions">
              <button type="button" className="button secondary" onClick={cancelConfirm} disabled={status === 'saving'}>
                Cancel
              </button>
              <button type="button" className="button" onClick={commitChanges} disabled={status === 'saving'}>
                {status === 'saving' ? 'Applying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
