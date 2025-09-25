'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { INVESTIGATION_SEVERITIES, INVESTIGATION_STATUSES } from '../../../../lib/investigations/constants';
import type { InvestigationDetail, InvestigationEvent } from '../../../../lib/data/investigations';

type StaffOption = {
  id: string;
  label: string;
  email: string;
};

type InvestigationDetailClientProps = {
  investigation: InvestigationDetail;
  events: InvestigationEvent[];
  staffOptions: StaffOption[];
  canManage: boolean;
};

type PendingField =
  | 'title'
  | 'status'
  | 'severity'
  | 'assignee'
  | 'summary'
  | 'tags'
  | 'note'
  | null;

function formatIsoDate(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    hour12: false,
    timeZone: 'UTC'
  });
}

function formatRelative(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function renderMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, null, 2);
  } catch (error) {
    console.warn('Failed to render event meta', error);
    return '{}';
  }
}

function computeTagInput(tags: string[]): string {
  return tags.join(', ');
}

export default function InvestigationDetailClient({
  investigation,
  events,
  staffOptions,
  canManage
}: InvestigationDetailClientProps) {
  const router = useRouter();
  const [state, setState] = useState(investigation);
  const [timeline, setTimeline] = useState(events);
  const [titleDraft, setTitleDraft] = useState(investigation.title);
  const [summaryDraft, setSummaryDraft] = useState(investigation.summary ?? '');
  const [tagsDraft, setTagsDraft] = useState(computeTagInput(investigation.tags));
  const [noteDraft, setNoteDraft] = useState('');
  const [pending, setPending] = useState<PendingField>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(investigation);
    setTitleDraft(investigation.title);
    setSummaryDraft(investigation.summary ?? '');
    setTagsDraft(computeTagInput(investigation.tags));
  }, [investigation]);

  useEffect(() => {
    setTimeline(events);
  }, [events]);

  const tagList = useMemo(() => state.tags, [state.tags]);

  function parseTagsInput(value: string): string[] {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
  }

  async function updateInvestigation(
    payload: Partial<{ title: string; status: string; severity: string; assignedTo: string | null; summary: string | null; tags: string[] }>,
    field: PendingField
  ) {
    if (!canManage) {
      return;
    }

    setPending(field);
    setError(null);

    try {
      const response = await fetch(`/api/investigations/${state.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        setError(text || 'Failed to update investigation');
        return;
      }

      const json = (await response.json()) as {
        investigation: InvestigationDetail;
        events?: InvestigationEvent[];
      };

      setState(json.investigation);
      setTitleDraft(json.investigation.title);
      setSummaryDraft(json.investigation.summary ?? '');
      setTagsDraft(computeTagInput(json.investigation.tags));
      if (json.events && json.events.length) {
        setTimeline((previous) => [...json.events!, ...previous]);
      }
      router.refresh();
    } catch (updateError) {
      console.error('Failed to update investigation', updateError);
      setError('Unexpected error while updating investigation');
    } finally {
      setPending(null);
    }
  }

  async function submitNote() {
    const message = noteDraft.trim();
    if (!message) {
      return;
    }

    setPending('note');
    setError(null);

    try {
      const response = await fetch(`/api/investigations/${state.id}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const text = await response.text();
        setError(text || 'Failed to add note');
        return;
      }

      const json = (await response.json()) as { event: InvestigationEvent };
      setTimeline((previous) => [json.event, ...previous]);
      setNoteDraft('');
      router.refresh();
    } catch (noteError) {
      console.error('Failed to add note', noteError);
      setError('Unexpected error while adding note');
    } finally {
      setPending(null);
    }
  }

  function disabledTooltip() {
    return canManage ? undefined : 'Requires investigator or security admin';
  }

  function resolveStaffLabel(id: string | null): string {
    if (!id) {
      return 'Unassigned';
    }
    const option = staffOptions.find((staff) => staff.id === id);
    return option?.label ?? option?.email ?? 'Unknown';
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-slate-100 shadow-2xl">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Title</label>
          <input
            type="text"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => {
              const trimmed = titleDraft.trim();
              if (trimmed && trimmed !== state.title) {
                void updateInvestigation({ title: trimmed }, 'title');
              } else {
                setTitleDraft(state.title);
              }
            }}
            disabled={!canManage || pending === 'title'}
            title={disabledTooltip()}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-lg font-semibold text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Status</label>
            <select
              value={state.status}
              disabled={!canManage || pending === 'status'}
              title={disabledTooltip()}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== state.status) {
                  void updateInvestigation({ status: value }, 'status');
                }
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {INVESTIGATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Severity</label>
            <select
              value={state.severity}
              disabled={!canManage || pending === 'severity'}
              title={disabledTooltip()}
              onChange={(event) => {
                const value = event.target.value;
                if (value !== state.severity) {
                  void updateInvestigation({ severity: value }, 'severity');
                }
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {INVESTIGATION_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Assignee</label>
            <select
              value={state.assignedTo.id ?? ''}
              disabled={!canManage || pending === 'assignee'}
              title={disabledTooltip()}
              onChange={(event) => {
                const value = event.target.value || null;
                if ((value ?? null) !== (state.assignedTo.id ?? null)) {
                  void updateInvestigation({ assignedTo: value }, 'assignee');
                }
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">Unassigned</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Opened by</label>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
              {state.openedBy.displayName ?? state.openedBy.email ?? 'Unknown'}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
            <span className="text-xs uppercase tracking-widest text-slate-500">Updated {formatRelative(state.updatedAt)}</span>
          </div>
          <div className="flex flex-col gap-4">
            {timeline.map((event) => {
              const actorName = event.actor.displayName ?? event.actor.email ?? 'System';
              const initials = actorName
                .split(/\s+/)
                .map((part) => part.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <article key={event.id} className="flex gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-sm font-semibold text-slate-200">
                    {initials || '∅'}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{actorName}</span>
                        <span className="text-xs uppercase tracking-widest text-slate-500">{event.kind.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-500">{formatRelative(event.createdAt)}</span>
                      </div>
                      {event.message && <p className="text-sm text-slate-200">{event.message}</p>}
                    </div>
                    {event.meta && Object.keys(event.meta).length > 0 && (
                      <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                        <summary className="cursor-pointer text-slate-400">Meta</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-slate-300">{renderMeta(event.meta)}</pre>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}

            {timeline.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
                No timeline activity yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Add note</h3>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Leave context for the next responder"
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
              disabled={!canManage || pending === 'note'}
              title={disabledTooltip()}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={!canManage || pending === 'note' || !noteDraft.trim()}
                className={clsx(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                  !canManage
                    ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                    : pending === 'note'
                      ? 'cursor-wait border-slate-700 bg-slate-800/60 text-slate-400'
                      : 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100'
                )}
              >
                {pending === 'note' ? 'Posting…' : 'Post note'}
              </button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 text-slate-200">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Summary</h3>
            <textarea
              value={summaryDraft}
              onChange={(event) => setSummaryDraft(event.target.value)}
              onBlur={() => {
                const trimmed = summaryDraft.trim();
                const canonical = state.summary ?? '';
                if (trimmed !== canonical) {
                  void updateInvestigation({ summary: trimmed || null }, 'summary');
                }
              }}
              disabled={!canManage || pending === 'summary'}
              title={disabledTooltip()}
              rows={6}
              placeholder="Document key findings, hypotheses, and next steps"
              className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Tags</h3>
            <input
              type="text"
              value={tagsDraft}
              onChange={(event) => setTagsDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseTagsInput(tagsDraft);
                if (JSON.stringify(parsed) !== JSON.stringify(tagList)) {
                  void updateInvestigation({ tags: parsed }, 'tags');
                }
              }}
              disabled={!canManage || pending === 'tags'}
              title={disabledTooltip()}
              placeholder="malware, phishing"
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-500"
            />
            <div className="flex flex-wrap gap-2">
              {tagList.map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-xs text-slate-200">
                  {tag}
                </span>
              ))}
              {tagList.length === 0 && <span className="text-xs text-slate-500">No tags yet</span>}
            </div>
          </section>

          <section className="flex flex-col gap-1 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>Opened</span>
              <span className="text-slate-200">{formatIsoDate(state.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Updated</span>
              <span className="text-slate-200">{formatIsoDate(state.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Assignee</span>
              <span className="text-slate-200">{resolveStaffLabel(state.assignedTo.id ?? null)}</span>
            </div>
          </section>
        </aside>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </section>
  );
}
