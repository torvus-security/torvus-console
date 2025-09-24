import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';
import { getStaffUser } from '../../lib/auth';
import { TokensPageContent } from './TokensPageContent';

export default async function TokensPage() {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return <AccessDeniedNotice />;
  }

  return <TokensPageContent displayName={staffUser.displayName} email={staffUser.email} />;
}
