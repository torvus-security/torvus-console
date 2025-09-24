import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { Box, Button, Callout, Flex, Text } from '@radix-ui/themes';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { PageHeader } from '../../../components/PageHeader';
import { ScrollToSectionButton } from '../../../components/actions/ScrollToSectionButton';
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
    headersMap.set('x-authenticated-staff-email', emailHeader);
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
    return (
      <Box py="9">
        <AccessDeniedNotice />
      </Box>
    );
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
    headerBag.get('x-authenticated-staff-email')
    ?? headerBag.get('x-session-user-email')
    ?? staffUser.email;

  let integrationsResult: FetchResult;

  try {
    integrationsResult = await fetchIntegrations(baseUrl, headerEmail);
  } catch (error) {
    console.error('failed to load integrations', error);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Integrations"
          description="Manage outbound notifications and event subscriptions."
          actions={(
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Signed in as {staffUser.displayName} ({staffUser.email})
              </Text>
              <ScrollToSectionButton targetId="add-integration" label="Add integration" />
            </Flex>
          )}
        />
        <Callout.Root color="crimson" role="alert">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Callout.Text>Unable to load integrations. Try again shortly.</Callout.Text>
            <Button color="crimson" variant="soft" asChild>
              <Link href="/admin/integrations">Retry</Link>
            </Button>
          </Flex>
        </Callout.Root>
      </div>
    );
  }

  if (integrationsResult.status === 401 || integrationsResult.status === 403 || !integrationsResult.data) {
    return (
      <Box py="9">
        <AccessDeniedNotice />
      </Box>
    );
  }

  const data = integrationsResult.data;
  const headerActions = (
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" color="gray">
        Signed in as {staffUser.displayName} ({staffUser.email})
      </Text>
      <ScrollToSectionButton targetId="add-integration" label="Add integration" />
    </Flex>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="Manage outbound notifications and event subscriptions."
        actions={headerActions}
      />

      <IntegrationsManager initialWebhooks={data.webhooks} initialEvents={data.events} />
    </div>
  );
}
