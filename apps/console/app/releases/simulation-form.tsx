'use client';

import { useActionState } from 'react';

export type SimulationResultState = {
  ok: boolean;
  message: string;
  correlationId?: string;
};

const INITIAL_STATE: SimulationResultState = {
  ok: false,
  message: 'No simulation run yet.'
};

export function SimulationForm({
  action
}: {
  action: (state: SimulationResultState, formData: FormData) => Promise<SimulationResultState>;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <section className="panel" aria-labelledby="simulate-heading">
      <div className="panel__header">
        <h2 id="simulate-heading">Simulate release</h2>
        <span className="tag subtle">No side effects</span>
      </div>
      <form action={formAction} className="simulate-form">
        <label>
          Release identifier
          <input name="releaseId" type="text" placeholder="2024.09.18" required disabled={isPending} />
        </label>
        <label>
          Notes
          <textarea name="notes" placeholder="Optional context" rows={3} maxLength={240} disabled={isPending} />
        </label>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Simulating…' : 'Run simulation'}
        </button>
      </form>
      <div className={state.ok ? 'simulate-result success' : 'simulate-result'} role="status">
        <h3>Result</h3>
        <p>{state.message}</p>
        {state.correlationId && <p className="muted">Correlation ID: {state.correlationId}</p>}
      </div>
    </section>
  );
}
