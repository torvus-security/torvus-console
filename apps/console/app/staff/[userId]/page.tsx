import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { RoleBadge } from '../../../components/RoleBadge';
import { getStaffUser } from '../../../lib/auth';
import { getCurrentStaffWithRoles, getStaffByIdWithRoles } from '../../../lib/data/staff';

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
  const staffUser = await getStaffUser();

  try {
    const currentStaff = staffUser ? await getCurrentStaffWithRoles(staffUser.email) : null;

    if (!currentStaff || !currentStaff.roles.includes('security_admin')) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <AccessDeniedNotice variant="card" />
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
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }
}
