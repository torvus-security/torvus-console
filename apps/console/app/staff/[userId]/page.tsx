import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { RoleBadge } from '../../../components/RoleBadge';
import { getCurrentStaffWithRoles, getStaffByIdWithRoles } from '../../../lib/data/staff';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const metadata: Metadata = {
  title: 'Staff member | Torvus Console'
};

type StaffDetailPageProps = {
  params: {
    userId: string;
  };
};

function PasskeyBadge({ enrolled }: { enrolled: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        enrolled
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-700/70 bg-slate-800/80 text-slate-400'
      )}
    >
      {enrolled ? '✓ Passkey enrolled' : '—'}
    </span>
  );
}

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const authz = await loadAuthz();

  if (!authz.allowed || !authz.email) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </div>
    );
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'staff-detail'
  });

  if (!isSecurityAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="You need the security administrator role to view staff profiles." />
      </div>
    );
  }

  try {
    const currentStaff = await getCurrentStaffWithRoles(authz.email);

    if (!currentStaff) {
      console.warn('[authz] staff-detail missing staff record', { email: authz.email, userId: params.userId });
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <DeniedPanel message="Your staff record is missing or inactive." />
        </div>
      );
    }

    const staffMember = await getStaffByIdWithRoles(params.userId);

    if (!staffMember) {
      return (
        <div className="flex flex-col gap-6 py-12">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 text-center shadow-2xl">
            <h1 className="text-2xl font-semibold text-slate-100">Staff member not found</h1>
            <p className="mt-2 text-sm text-slate-400">The requested staff profile does not exist.</p>
            <div className="mt-6">
              <Link
                href="/staff"
                className="inline-flex items-center rounded-full border border-slate-700/70 px-4 py-1.5 text-sm font-medium text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200"
              >
                Back to directory
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 py-6">
        <Link
          href="/staff"
          className="self-start rounded-full border border-slate-700/70 px-4 py-1.5 text-sm font-medium text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200"
        >
          ← Back to directory
        </Link>
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold text-slate-100">{staffMember.displayName}</h1>
              <p className="text-sm text-slate-400">{staffMember.email}</p>
              <PasskeyBadge enrolled={staffMember.passkeyEnrolled} />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wide text-slate-500">Roles</span>
              <div className="flex flex-wrap gap-2">
                {staffMember.roles.length ? (
                  staffMember.roles.map((role) => <RoleBadge key={role} role={role} />)
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    console.error('Failed to load staff profile', error);
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Unable to load the staff profile. Try again shortly." />
      </div>
    );
  }
}
