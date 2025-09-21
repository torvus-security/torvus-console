import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStaffUser } from '../../lib/auth';
import { EnrollmentForm } from './enrollment-form';
import { completeEnrollmentAction } from './actions';

export default async function EnrollPasskeyPage() {
  const staffUser = await getStaffUser();
  if (!staffUser) {
    redirect('/');
  }

  if (staffUser.passkeyEnrolled) {
    redirect('/overview');
  }

  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();

  return (
    <div className="page">
      <header className="panel" aria-labelledby="passkey-heading">
        <div className="panel__header">
          <h1 id="passkey-heading">Passkey enrollment required</h1>
          <span className="tag danger">Blocker</span>
        </div>
        <p>
          Torvus enforces passkeys for all privileged staff. This enrollment gates access to production controls and is audited against the correlation ID below. Complete the steps to
          continue.
        </p>
        <dl className="kv">
          <div>
            <dt>Staff member</dt>
            <dd>{staffUser.displayName} ({staffUser.email})</dd>
          </div>
          <div>
            <dt>Correlation ID</dt>
            <dd>{correlationId}</dd>
          </div>
        </dl>
        <p className="muted">
          TODO: Integrate WebAuthn ceremony via Supabase Auth once the security hardening review signs off. Until then, this stub flips the enrolled flag for developer testing only.
        </p>
      </header>

      <EnrollmentForm action={completeEnrollmentAction} />
    </div>
  );
}
