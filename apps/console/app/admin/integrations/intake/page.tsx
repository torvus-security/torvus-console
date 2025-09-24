import { cookies, headers } from 'next/headers';
import { AccessDeniedNotice } from '../../../../components/AccessDeniedNotice';
import { IntakeIntegrationsManager, type IntakeIntegrationsManagerProps } from '../../../../components/admin/IntakeIntegrationsManager';
import { getStaffUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

type ApiResponse = {
  integrations: IntakeIntegrationsManagerProps['initialIntegrations'];
};

type FetchResult =
  | { status: 401 | 403; data: null }
  | { status: 200; data: ApiResponse };

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

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
    headersMap.set('x-authenticated-staff-email', emailHeader);
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
  const staffUser = await getStaffUser();

  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return <AccessDeniedNotice />;
  }

  const baseUrl = resolveBaseUrl();
  const headerBag = headers();
  const headerEmail =
    headerBag.get('x-authenticated-staff-email')
    ?? headerBag.get('x-session-user-email')
    ?? staffUser.email;

  const { status, data } = await fetchIntakeData(baseUrl, headerEmail);

  if (status === 401 || status === 403 || !data) {
    return <AccessDeniedNotice />;
  }

  return (
    <div className="page">
      <IntakeIntegrationsManager initialIntegrations={data.integrations} intakeBaseUrl={baseUrl} />
    </div>
  );
}
