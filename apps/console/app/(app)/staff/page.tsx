import type { Metadata } from 'next';
import { PageHeader } from '../../../components/PageHeader';
import { StaffTable } from '../../../components/StaffTable';
import { getAllStaffWithRoles, getCurrentStaffWithRoles } from '../../../lib/data/staff';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const metadata: Metadata = {
  title: 'Staff directory | Torvus Console'
};

const PAGE_SIZE = 25;

type StaffPageProps = {
  searchParams?: {
    q?: string;
    page?: string;
  };
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
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
    context: 'staff-directory'
  });

  if (!isSecurityAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="You need the security administrator role to view the staff directory." />
      </div>
    );
  }

  const rawQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const query = rawQuery.trim();
  const pageParam = typeof searchParams?.page === 'string' ? Number.parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const currentStaff = await getCurrentStaffWithRoles(authz.email);

    if (!currentStaff) {
      console.warn('[authz] staff-directory missing staff record', { email: authz.email });
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <DeniedPanel message="Your staff record is missing or inactive." />
        </div>
      );
    }

    const { staff, count } = await getAllStaffWithRoles({ q: query, limit: PAGE_SIZE, offset });

    return (
      <div className="flex flex-col gap-8 py-6">
        <PageHeader title="Staff directory" description="Manage Torvus operators and assigned roles." />
        <StaffTable staff={staff} query={query} page={page} pageSize={PAGE_SIZE} totalCount={count} />
      </div>
    );
  } catch (error) {
    console.error('Failed to load staff directory', error);
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <DeniedPanel message="Unable to load the staff directory. Try again shortly." />
      </div>
    );
  }
}
