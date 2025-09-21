import { cookies, headers } from 'next/headers';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { IntegrationsManager, type IntegrationsManagerProps } from '../../../components/admin/IntegrationsManager';
import { getStaffUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

type ApiResponse = {
  webhooks: IntegrationsManagerProps['initialWebhooks'];
  events: IntegrationsManagerProps['initialEvents'];
};

type FetchResult =
  | { status: 401 | 403; data: null }
  | { status: 200; data: ApiResponse };

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

async function fetchIntegrations(baseUrl: string, emailHeader: string | null): Promise<FetchResult> {
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
    headersMap.set('cf-access-authenticated-user-email', emailHeader);
  }

  const response = await fetch(`${baseUrl}/api/admin/integrations`, {
    cache: 'no-store',
    headers: headersMap
  });

  if (response.status === 401 || response.status === 403) {
    return { status: response.status as 401 | 403, data: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to load integrations (${response.status})`);
  }

  const payload = (await response.json()) as ApiResponse;
  return { status: 200, data: payload };
}

export default async function AdminIntegrationsPage() {
  const staffUser = await getStaffUser();

  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return <AccessDeniedNotice />;
  }

  const headerBag = headers();
  const host = headerBag.get('x-forwarded-host') ?? headerBag.get('host');
  const protoHeader = headerBag.get('x-forwarded-proto');

  let baseUrl: string;
  if (host) {
    const normalisedHost = host.toLowerCase();
    const defaultProto = normalisedHost.includes('localhost') || normalisedHost.includes('127.0.0.1') ? 'http' : 'https';
    const protocol = protoHeader ?? defaultProto;
    baseUrl = `${protocol}://${host}`;
  } else {
    baseUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3000';
  }

  const headerEmail =
    headerBag.get('cf-access-authenticated-user-email')
    ?? headerBag.get('Cf-Access-Authenticated-User-Email')
    ?? staffUser.email;

  const { status, data } = await fetchIntegrations(baseUrl, headerEmail);

  if (status === 401 || status === 403) {
    return <AccessDeniedNotice />;
  }

  if (!data) {
    throw new Error('Integrations payload missing');
  }

  return (
    <div className="page">
      <IntegrationsManager initialWebhooks={data.webhooks} initialEvents={data.events} />
    </div>
  );
}
