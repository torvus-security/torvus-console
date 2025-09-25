import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getStaffUser } from '../../../../lib/auth';
import {
  getInvestigationById,
  listInvestigationEvents,
  type InvestigationDetail
} from '../../../../lib/data/investigations';
import { getAllStaffWithRoles } from '../../../../lib/data/staff';
import InvestigationDetailClient from '../../components/InvestigationDetailClient';
import { loadAuthz, authorizeRoles } from '../../../(lib)/authz';
import { DeniedPanel } from '../../../(lib)/denied-panel';

export const metadata = {
  title: 'Investigation detail | Torvus Console'
};

type PageParams = {
  params: { id: string };
};

type StaffOption = {
  id: string;
  label: string;
  email: string;
};

async function loadStaffOptions(): Promise<StaffOption[]> {
  try {
    const { staff } = await getAllStaffWithRoles({ limit: 200 });
    return staff.map((entry) => ({
      id: entry.id,
      label: entry.displayName,
      email: entry.email
    }));
  } catch (error) {
    console.warn('Failed to load staff directory for assignments', error);
    return [];
  }
}

async function InvestigationDetailLoader({
  investigation,
  canManage
}: {
  investigation: InvestigationDetail;
  canManage: boolean;
}) {
  const [events, staffOptions] = await Promise.all([
    listInvestigationEvents(investigation.id),
    loadStaffOptions()
  ]);

  return (
    <InvestigationDetailClient
      investigation={investigation}
      events={events}
      staffOptions={staffOptions}
      canManage={canManage}
    />
  );
}

export default async function InvestigationDetailPage({ params }: PageParams) {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </div>
    );
  }

  const hasInvestigationsRole = authorizeRoles(authz, {
    anyOf: ['security_admin', 'auditor', 'investigator'],
    context: 'investigations-detail'
  });

  if (!hasInvestigationsRole) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Investigations require investigator, security administrator, or auditor privileges." />
      </div>
    );
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Unable to resolve your staff identity." />
      </div>
    );
  }

  const hasViewPermission = staffUser.permissions.includes('investigations.view');

  if (!hasViewPermission) {
    console.warn('[authz] investigation-detail missing permission', {
      email: staffUser.email,
      permissions: staffUser.permissions
    });
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Investigations require investigator, security administrator, or auditor privileges." />
      </div>
    );
  }

  const investigation = await getInvestigationById(params.id);

  if (!investigation) {
    notFound();
  }

  const canManage = staffUser.permissions.includes('investigations.manage');

  return (
    <div className="flex flex-col gap-6 py-6">
      <Link
        href="/investigations"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
      >
        ← Back to investigations
      </Link>

      <Suspense fallback={<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-slate-200">Loading…</div>}>
        <InvestigationDetailLoader investigation={investigation} canManage={canManage} />
      </Suspense>
    </div>
  );
}
