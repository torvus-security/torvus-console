import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getIdentityFromRequestHeaders, getStaffUser } from './auth';
import { requireRole } from './authz/gate';

export async function withRequiredRole<T>(
  allowed: Array<'security_admin' | 'auditor'>,
  render: (ctx: { email: string; roles: string[] }) => Promise<T> | T
): Promise<T | ReactNode> {
  const { email } = getIdentityFromRequestHeaders();
  if (!email) {
    return redirect('/access-denied?reason=missing_email');
  }

  const staffUser = await getStaffUser();
  if (!staffUser) {
    return redirect('/access-denied?reason=not_enrolled');
  }

  if (!requireRole(staffUser.roles, allowed)) {
    return redirect('/access-denied?reason=insufficient_role');
  }

  return render({ email, roles: staffUser.roles });
}
