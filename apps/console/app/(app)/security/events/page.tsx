import AuditPage from '../../audit/page';
import { withRequiredRole } from '../../../../lib/with-authz';

export { metadata } from '../../audit/page';

type AuditPageProps = Parameters<typeof AuditPage>[0];

export default function SecurityEventsPage(props: AuditPageProps) {
  return withRequiredRole(['security_admin', 'auditor'], () => AuditPage(props));
}
