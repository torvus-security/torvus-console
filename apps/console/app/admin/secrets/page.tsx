import { SecretsManager } from '../../../components/admin/SecretsManager';
import { loadSecretsSummary, loadSecretRequests } from '../../../server/secrets';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

export default async function SecretsAdminPage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'admin-secrets'
  });

  if (!isSecurityAdmin) {
    return <DeniedPanel message="You need the security administrator role to manage secrets." />;
  }

  const [secrets, requests] = await Promise.all([loadSecretsSummary(), loadSecretRequests(50)]);

  return (
    <div className="page">
      <SecretsManager secrets={secrets} requests={requests} />
    </div>
  );
}
