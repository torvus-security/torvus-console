'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { INVESTIGATION_SEVERITIES } from '../../../lib/investigations/constants';

type NewInvestigationDialogProps = {
  canManage: boolean;
};

function normaliseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
}

export default function NewInvestigationDialog({ canManage }: NewInvestigationDialogProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const severityOptions = useMemo(() => INVESTIGATION_SEVERITIES, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setSubmitting(false);
    setError(null);
    formRef.current?.reset();
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) {
        return;
      }

      const form = event.currentTarget;
      const formData = new FormData(form);
      const title = (formData.get('title') as string | null)?.trim() ?? '';
      const severity = (formData.get('severity') as string | null)?.trim().toLowerCase() ?? 'medium';
      const summary = (formData.get('summary') as string | null)?.trim() ?? '';
      const tagsInput = (formData.get('tags') as string | null)?.trim() ?? '';

      if (!title) {
        setError('Title is required.');
        return;
      }

      if (!severityOptions.includes(severity as (typeof INVESTIGATION_SEVERITIES)[number])) {
        setError('Invalid severity selection.');
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const response = await fetch('/api/investigations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            severity,
            summary: summary || undefined,
            tags: normaliseTags(tagsInput)
          })
        });

        if (!response.ok) {
          const text = await response.text();
          setError(text || 'Failed to create investigation.');
          setSubmitting(false);
          return;
        }

        closeDialog();
        router.refresh();
      } catch (submitError) {
        console.error('Failed to create investigation', submitError);
        setError('Unexpected error creating investigation.');
        setSubmitting(false);
      }
    },
    [closeDialog, router, severityOptions, submitting]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canManage}
        title={canManage ? undefined : 'Requires investigator or security admin role'}
        className={clsx(
          'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
          canManage
            ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100'
            : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-500'
        )}
      >
        + New investigation
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">New investigation</h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-transparent p-2 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="title" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder="Example: Suspicious login trail"
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="severity" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Severity
                  </label>
                  <select
                    id="severity"
                    name="severity"
                    defaultValue="medium"
                    className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {severityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="tags" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Tags
                  </label>
                  <input
                    id="tags"
                    name="tags"
                    type="text"
                    placeholder="threat-intel, phishing"
                    className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-slate-500">Comma separated</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="summary" className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Summary
                </label>
                <textarea
                  id="summary"
                  name="summary"
                  rows={4}
                  placeholder="What triggered this investigation?"
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {error && <p className="text-sm text-rose-300">{error}</p>}

              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={clsx(
                    'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                    submitting
                      ? 'cursor-wait border-slate-700 bg-slate-800/60 text-slate-400'
                      : 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100'
                  )}
                >
                  {submitting ? 'Creating…' : 'Create investigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
