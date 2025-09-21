import type { Metadata } from 'next';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { StaffTable } from '../../components/StaffTable';
import { getStaffUser } from '../../lib/auth';
import { getAllStaffWithRoles, getCurrentStaffWithRoles } from '../../lib/data/staff';

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
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }

  const rawQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const query = rawQuery.trim();
  const pageParam = typeof searchParams?.page === 'string' ? Number.parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const currentStaff = await getCurrentStaffWithRoles(staffUser.email);

    if (!currentStaff || !currentStaff.roles.includes('security_admin')) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <AccessDeniedNotice variant="card" />
        </div>
      );
    }

    const { staff, count } = await getAllStaffWithRoles({ q: query, limit: PAGE_SIZE, offset });

    return (
      <div className="flex flex-col gap-8 py-6">
        <StaffTable staff={staff} query={query} page={page} pageSize={PAGE_SIZE} totalCount={count} />
      </div>
    );
  } catch (error) {
    console.error('Failed to load staff directory', error);
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }
}
