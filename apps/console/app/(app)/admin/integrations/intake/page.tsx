import { cookies, headers } from 'next/headers';
import { IntakeIntegrationsManager, type IntakeIntegrationsManagerProps } from '../../../../../components/admin/IntakeIntegrationsManager';
import { getIdentityFromRequestHeaders, getStaffUser } from '../../../../../lib/auth';
import { loadAuthz, authorizeRoles } from '../../../../(lib)/authz';
import { DeniedPanel } from '../../../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

type ApiResponse = {
  integrations: IntakeIntegrationsManagerProps['initialIntegrations'];
};

type FetchResult =
  | { status: 401 | 403; data: null }
  | { status: 200; data: ApiResponse };

async function fetchIntakeData(baseUrl: string, emailHeader: string | null): Promise<FetchResult> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const headersMap = new Headers();
  if (cookieHeader) {
    headersMap.set('cookie', cookieHeader);
  }
  if (emailHeader) {
    headersMap.set('x-torvus-console-email', emailHeader);
  }

  const response = await fetch(`${baseUrl}/api/admin/integrations/intake`, {
    cache: 'no-store',
    headers: headersMap
  });

  if (response.status === 401 || response.status === 403) {
    return { status: response.status as 401 | 403, data: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to load intake integrations (${response.status})`);
  }

  const payload = (await response.json()) as ApiResponse;
  return { status: 200, data: payload };
}

function resolveBaseUrl(): string {
  const headerBag = headers();
  const host = headerBag.get('x-forwarded-host') ?? headerBag.get('host');
  const protoHeader = headerBag.get('x-forwarded-proto');

  if (host) {
    const normalisedHost = host.toLowerCase();
    const defaultProto = normalisedHost.includes('localhost') || normalisedHost.includes('127.0.0.1') ? 'http' : 'https';
    const protocol = protoHeader ?? defaultProto;
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3000';
}

export default async function IntakeIntegrationsPage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'admin-integrations-intake'
  });

  if (!isSecurityAdmin) {
    return <DeniedPanel message="You need the security administrator role to manage intake integrations." />;
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return <DeniedPanel message="Unable to resolve your staff identity." />;
  }

  const baseUrl = resolveBaseUrl();
  const headerBag = headers();
  const identity = getIdentityFromRequestHeaders(headerBag);
  const headerEmail = identity.email ?? staffUser.email;

  const { status, data } = await fetchIntakeData(baseUrl, headerEmail);

  if (status === 401 || status === 403 || !data) {
    return <DeniedPanel message="You do not have permission to manage intake integrations." />;
  }

  return (
    <div className="page">
      <IntakeIntegrationsManager initialIntegrations={data.integrations} intakeBaseUrl={baseUrl} />
    </div>
  );
}
