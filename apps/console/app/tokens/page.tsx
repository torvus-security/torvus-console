import { getStaffUser } from '../../lib/auth';
import { TokensPageContent } from './TokensPageContent';
import { loadAuthz } from '../(lib)/authz';
import { DeniedPanel } from '../(lib)/denied-panel';

export default async function TokensPage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return <DeniedPanel />;
  }

  return <TokensPageContent displayName={staffUser.displayName} email={staffUser.email} />;
}
