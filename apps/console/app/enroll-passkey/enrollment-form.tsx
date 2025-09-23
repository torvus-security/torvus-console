'use client';

import { Button } from '@radix-ui/themes';
import { useActionState } from 'react';
import type { EnrollmentState } from './types';

const INITIAL_STATE: EnrollmentState = {
  ok: false,
  message: 'Begin passkey enrollment to unlock Torvus Console.'
};

export function EnrollmentForm({
  action
}: {
  action: (state: EnrollmentState, formData: FormData) => Promise<EnrollmentState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <section className="panel" aria-labelledby="enroll-heading">
      <div className="panel__header">
        <h2 id="enroll-heading">Enroll passkey</h2>
        <span className="tag subtle">Required</span>
      </div>
      <form action={formAction} className="enroll-form">
        <p>
          Torvus requires platform staff to enroll a platform-managed passkey. Confirm possession of your FIDO2 key and follow the prompts. TOTP fallback is only permitted when the
          security admin toggles the override flag.
        </p>
        <label className="checkbox">
          <input type="checkbox" name="acknowledged" required disabled={pending} />
          <span>I understand this enrollment is mandatory and agree to audit logging.</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="requestTotp" disabled={pending} />
          <span>Request TOTP fallback (requires security_admin approval).</span>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? 'Enrolling…' : 'Begin enrollment'}
        </Button>
      </form>
      <div className={state.ok ? 'enroll-result success' : 'enroll-result'} role="status">
        <strong>{state.ok ? 'Enrollment complete' : 'Action required'}</strong>
        <p>{state.message}</p>
      </div>
    </section>
  );
}
