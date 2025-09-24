import { AppShell } from '../../components/AppShell';
import { Sidebar } from '../../components/Sidebar';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { getStaffUser } from '../../lib/auth';
import { TokensPageContent } from './TokensPageContent';

export default async function TokensPage() {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <AppShell sidebar={<Sidebar />}>
        <AccessDeniedNotice />
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<Sidebar />}>
      <TokensPageContent displayName={staffUser.displayName} email={staffUser.email} />
    </AppShell>
  );
}
