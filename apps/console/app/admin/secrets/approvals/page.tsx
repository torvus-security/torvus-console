import { AccessDeniedNotice } from '../../../../components/AccessDeniedNotice';
import { SecretApprovals } from '../../../../components/admin/SecretApprovals';
import { getStaffUser } from '../../../../lib/auth';
import { loadSecretRequests } from '../../../../server/secrets';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export default async function SecretApprovalsPage() {
  const staffUser = await getStaffUser();
  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return <AccessDeniedNotice />;
  }

  const requests = await loadSecretRequests(100);

  return (
    <div className="page">
      <SecretApprovals requests={requests} />
    </div>
  );
}
