'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';
import type { EnrollmentState } from './types';

const EnrollmentSchema = z.object({
  acknowledged: z.string().optional(),
  requestTotp: z.string().optional()
});

export async function completeEnrollmentAction(
  _prevState: EnrollmentState,
  formData: FormData
): Promise<EnrollmentState> {
  const staffUser = await requireStaff();
  const parsed = EnrollmentSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success || !parsed.data.acknowledged) {
    return {
      ok: false,
      message: 'You must acknowledge the enrollment policy before continuing.'
    };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await (supabase
    .from('staff_users') as any)
    .update({ passkey_enrolled: true } as Record<string, unknown>)
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
