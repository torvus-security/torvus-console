import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getStaffUser, requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';
import { EnrollmentForm, type EnrollmentState } from './enrollment-form';

const EnrollmentSchema = z.object({
  acknowledged: z.string().optional(),
  requestTotp: z.string().optional()
});

export async function completeEnrollmentAction(
  _prevState: EnrollmentState,
  formData: FormData
): Promise<EnrollmentState> {
  'use server';
  const staffUser = await requireStaff();
  const parsed = EnrollmentSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success || !parsed.data.acknowledged) {
    return {
      ok: false,
      message: 'You must acknowledge the enrollment policy before continuing.'
    };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from('staff_users')
    .update({ passkey_enrolled: true })
    .eq('user_id', staffUser.id);

  if (error) {
    console.error('Failed to mark passkey enrollment', error);
    return {
      ok: false,
      message: 'Enrollment update failed. Contact Security Engineering.'
    };
  }

  if (parsed.data.requestTotp) {
    console.info('TOTP fallback requested', {
      userId: staffUser.id,
      email: staffUser.email,
      correlationId: crypto.randomUUID()
    });
  }

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/enroll-passkey/complete',
    user: staffUser.analyticsId,
    env: process.env.NODE_ENV ?? 'development'
  });

  revalidatePath('/');
  revalidatePath('/overview');

  return {
    ok: true,
    message: 'Passkey enrollment recorded. Continue into the Console to proceed.'
  };
}

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
