import { SecretApprovals } from '../../../../components/admin/SecretApprovals';
import { loadSecretRequests } from '../../../../server/secrets';
import { loadAuthz, authorizeRoles } from '../../../(lib)/authz';
import { DeniedPanel } from '../../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

export default async function SecretApprovalsPage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'admin-secrets-approvals'
  });

  if (!isSecurityAdmin) {
    return <DeniedPanel message="You need the security administrator role to review secret approvals." />;
  }

  const requests = await loadSecretRequests(100);

  return (
    <div className="page">
      <SecretApprovals requests={requests} />
    </div>
  );
}
