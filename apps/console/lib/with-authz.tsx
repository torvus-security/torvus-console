import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getIdentityFromRequestHeaders, getStaffUser } from './auth';
import { requireRole } from './authz/gate';

export async function withRequiredRole<T>(
  allowed: Array<'security_admin' | 'auditor'>,
  render: (ctx: { email: string; roles: string[] }) => Promise<T> | T
): Promise<T | ReactNode> {
  const staffUser = await getStaffUser();
  if (!staffUser) {
    return redirect('/access-denied?reason=not_enrolled');
  }

  const { email: identityEmail } = getIdentityFromRequestHeaders();
  const email = identityEmail ?? staffUser.email;

  if (!requireRole(staffUser.roles, allowed)) {
    return redirect('/access-denied?reason=insufficient_role');
  }

  return render({ email, roles: staffUser.roles });
}
