'use client';

import { useEffect, useMemo, useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../../../components/ui/button';
import { cn } from '../../../../../utils/cn';
import {
  archiveJournalistAction,
  restoreJournalistAction,
  updateCapabilityAction,
  updatePlanAction
} from './actions';

type CapabilityGrantInfo = {
  capability: string;
  grantedAt: string | null;
  grantedBy: string | null;
};

type EntitlementsPanelProps = {
  userId: string;
  planKey: string;
  planSetAt: string | null;
  planSetBy: string | null;
  planOptions: string[];
  capabilityOptions: string[];
  capabilityGrants: CapabilityGrantInfo[];
};

type FeedbackKind = 'success' | 'error';

type FeedbackState = {
  type: FeedbackKind;
  message: string;
};

type ActionResult = Awaited<ReturnType<typeof updatePlanAction>>;

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  standard: 'Standard',
  journalist: 'Journalist'
};

const CAPABILITY_LABELS: Record<string, string> = {
  journalist: 'Journalist workspace'
};

function formatTimestamp(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function EntitlementsPanel({
  userId,
  planKey,
  planSetAt,
  planSetBy,
  planOptions,
  capabilityOptions,
  capabilityGrants
}: EntitlementsPanelProps) {
  const router = useRouter();

  const planOptionSet = useMemo(() => new Set(planOptions), [planOptions]);
  const capabilityOptionSet = useMemo(() => new Set(capabilityOptions), [capabilityOptions]);

  const initialPlan = planOptionSet.has(planKey) ? planKey : planOptions[0] ?? '';
  const initialUnknownPlan = planOptionSet.has(planKey) ? null : planKey;
  const initialJournalistGrant = capabilityGrants.find((grant) => grant.capability === 'journalist') ?? null;

  const [currentPlan, setCurrentPlan] = useState(initialPlan);
  const [unknownPlan, setUnknownPlan] = useState<string | null>(initialUnknownPlan);
  const [planMeta, setPlanMeta] = useState<{ setAt: string | null; setBy: string | null }>({
    setAt: planSetAt,
    setBy: planSetBy
  });

  const [hasJournalistGrant, setHasJournalistGrant] = useState(Boolean(initialJournalistGrant));
  const [journalistGrantMeta, setJournalistGrantMeta] = useState<CapabilityGrantInfo | null>(initialJournalistGrant);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<'archive' | 'restore' | null>(null);

  const [isPlanPending, startPlanTransition] = useTransition();
  const [isCapabilityPending, startCapabilityTransition] = useTransition();
  const [isArchivePending, startArchiveTransition] = useTransition();
  const [isRestorePending, startRestoreTransition] = useTransition();

  useEffect(() => {
    const known = planOptionSet.has(planKey);
    setCurrentPlan(known ? planKey : planOptions[0] ?? planKey);
    setUnknownPlan(known ? null : planKey);
  }, [planKey, planOptionSet, planOptions]);

  useEffect(() => {
    setPlanMeta({ setAt: planSetAt, setBy: planSetBy });
  }, [planSetAt, planSetBy]);

  useEffect(() => {
    const grant = capabilityGrants.find((entry) => entry.capability === 'journalist') ?? null;
    setHasJournalistGrant(Boolean(grant));
    setJournalistGrantMeta(grant);
  }, [capabilityGrants]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const planLastUpdated = formatTimestamp(planMeta.setAt);

  const applyResult = (result: ActionResult) => {
    setFeedback({
      type: result.success ? 'success' : 'error',
      message: result.message
    });
  };

  const handlePlanChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextPlan = event.target.value.trim();
    if (!nextPlan || nextPlan === currentPlan || !planOptionSet.has(nextPlan)) {
      return;
    }

    startPlanTransition(() => {
      updatePlanAction({ userId, planKey: nextPlan })
        .then((result) => {
          applyResult(result);
          if (result.success) {
            setCurrentPlan(nextPlan);
            setUnknownPlan(null);
            router.refresh();
          }
        })
        .catch((error) => {
          console.error('[entitlements] unexpected plan update failure', error);
          setFeedback({ type: 'error', message: 'Failed to update plan.' });
        });
    });
  };

  const toggleJournalistCapability = (enable: boolean) => {
    if (!capabilityOptionSet.has('journalist')) {
      setFeedback({ type: 'error', message: 'Journalist capability is not available in this environment.' });
      return;
    }

    startCapabilityTransition(() => {
      updateCapabilityAction({ userId, capability: 'journalist', enable })
        .then((result) => {
          applyResult(result);
          if (result.success) {
            setHasJournalistGrant(enable);
            if (enable) {
              setJournalistGrantMeta({ capability: 'journalist', grantedAt: new Date().toISOString(), grantedBy: null });
            } else {
              setJournalistGrantMeta(null);
            }
            router.refresh();
          }
        })
        .catch((error) => {
          console.error('[entitlements] unexpected capability toggle failure', error);
          setFeedback({ type: 'error', message: 'Failed to update capability.' });
        });
    });
  };

  const runArchive = () => {
    startArchiveTransition(() => {
      archiveJournalistAction({ userId })
        .then((result) => {
          applyResult(result);
          if (result.success) {
            setCurrentPlan(planOptionSet.has('standard') ? 'standard' : currentPlan);
            setUnknownPlan(null);
            setHasJournalistGrant(false);
            setJournalistGrantMeta(null);
            router.refresh();
          }
        })
        .catch((error) => {
          console.error('[entitlements] unexpected archive failure', error);
          setFeedback({ type: 'error', message: 'Failed to disable journalist access.' });
        })
        .finally(() => {
          setConfirmIntent(null);
        });
    });
  };

  const runRestore = () => {
    startRestoreTransition(() => {
      restoreJournalistAction({ userId })
        .then((result) => {
          applyResult(result);
          if (result.success) {
            setCurrentPlan(planOptionSet.has('journalist') ? 'journalist' : currentPlan);
            setUnknownPlan(null);
            router.refresh();
          }
        })
        .catch((error) => {
          console.error('[entitlements] unexpected restore failure', error);
          setFeedback({ type: 'error', message: 'Failed to restore journalist access.' });
        })
        .finally(() => {
          setConfirmIntent(null);
        });
    });
  };

  const isConfirmPending = confirmIntent === 'archive' ? isArchivePending : confirmIntent === 'restore' ? isRestorePending : false;

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          role="status"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm shadow',
            feedback.type === 'success'
              ? 'border-emerald-500/70 bg-emerald-950/40 text-emerald-100'
              : 'border-rose-500/70 bg-rose-950/40 text-rose-100'
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {unknownPlan ? (
        <div className="rounded-xl border border-amber-500/70 bg-amber-950/40 p-4 text-sm text-amber-100">
          Assigned plan <span className="font-semibold">{unknownPlan}</span> is not recognised. Select a supported plan to update.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <header className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Plan</h2>
          <p className="text-sm text-slate-400">Assign the plan that controls baseline product access.</p>
        </header>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex w-full max-w-xs flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">Current plan</span>
            <select
              value={currentPlan}
              onChange={handlePlanChange}
              disabled={isPlanPending || isArchivePending || isRestorePending || !planOptions.length}
              className="h-10 rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-slate-50 shadow-inner shadow-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
            >
              {planOptions.map((option) => (
                <option key={option} value={option}>
                  {PLAN_LABELS[option] ?? option}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500">
            {planLastUpdated ? (
              <span>
                Last updated {planLastUpdated}
                {planMeta.setBy ? ` by ${planMeta.setBy}` : ''}
              </span>
            ) : (
              <span>No recorded plan changes</span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <header className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Capabilities</h2>
          <p className="text-sm text-slate-400">Grant additional features beyond the selected plan.</p>
        </header>
        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
              checked={hasJournalistGrant}
              onChange={(event) => toggleJournalistCapability(event.target.checked)}
              disabled={isCapabilityPending || isArchivePending || !capabilityOptionSet.has('journalist')}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-100">{CAPABILITY_LABELS.journalist}</p>
              <p className="text-xs text-slate-400">
              {journalistGrantMeta
                ? `Granted ${formatTimestamp(journalistGrantMeta.grantedAt) ?? 'previously'}${journalistGrantMeta.grantedBy ? ` by ${journalistGrantMeta.grantedBy}` : ''}`
                : 'Enable to unlock Cases, Intake inbox, and related tooling.'}
              </p>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <header className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Journalist lifecycle</h2>
          <p className="text-sm text-slate-400">Temporarily suspend or restore journalist capabilities across the platform.</p>
        </header>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="solid"
            className="bg-rose-600 text-white hover:bg-rose-500"
            onClick={() => setConfirmIntent('archive')}
            disabled={isArchivePending || isRestorePending}
          >
            Disable Journalist &amp; Archive Cases
          </Button>
          <Button
            variant="outline"
            className="border-emerald-500/60 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-900/30"
            onClick={() => setConfirmIntent('restore')}
            disabled={isArchivePending || isRestorePending}
          >
            Re-enable Journalist &amp; Restore Cases
          </Button>
        </div>
      </section>

      {confirmIntent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-50">
              {confirmIntent === 'archive'
                ? 'Disable journalist access?'
                : 'Restore journalist access?'}
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              {confirmIntent === 'archive'
                ? 'This will downgrade the user to the Standard plan, revoke journalist capability grants, and archive all journalist cases. You can reverse this later.'
                : 'This will restore the Journalist plan and unarchive cases for the user.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setConfirmIntent(null)}
                disabled={isConfirmPending}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                className={cn(
                  confirmIntent === 'archive'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                )}
                onClick={confirmIntent === 'archive' ? runArchive : runRestore}
                disabled={isConfirmPending}
              >
                {isConfirmPending
                  ? 'Working…'
                  : confirmIntent === 'archive'
                    ? 'Confirm disable'
                    : 'Confirm restore'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
