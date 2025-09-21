import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { SecretsManager } from '../../../components/admin/SecretsManager';
import { getStaffUser } from '../../../lib/auth';
import { loadSecretsSummary, loadSecretRequests } from '../../../server/secrets';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export default async function SecretsAdminPage() {
  const staffUser = await getStaffUser();
  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return <AccessDeniedNotice />;
  }

  const [secrets, requests] = await Promise.all([loadSecretsSummary(), loadSecretRequests(50)]);

  return (
    <div className="page">
      <SecretsManager secrets={secrets} requests={requests} />
    </div>
  );
}
