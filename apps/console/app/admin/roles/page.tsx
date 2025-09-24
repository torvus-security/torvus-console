import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { Box, Button, Callout, Flex, Text } from '@radix-ui/themes';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { AppShell } from '../../../components/AppShell';
import { Sidebar } from '../../../components/Sidebar';
import { PageHeader } from '../../../components/PageHeader';
import { ScrollToSectionButton } from '../../../components/actions/ScrollToSectionButton';
import { RoleManager, type RoleMemberRecord } from '../../../components/admin/RoleManager';
import { getStaffUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

type RoleDefinition = {
  id: string;
  name: string;
  description: string;
};

type RolesApiResponse = {
  roles: RoleDefinition[];
  members: RoleMemberRecord[];
};

type FetchRolesResult =
  | { status: 401 | 403; data: null }
  | { status: 200; data: RolesApiResponse };

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

async function fetchRoles(baseUrl: string, emailHeader: string | null): Promise<FetchRolesResult> {
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

  const response = await fetch(`${baseUrl}/api/admin/roles`, {
    cache: 'no-store',
    headers: headersMap
  });

  if (response.status === 401 || response.status === 403) {
    return { status: response.status as 401 | 403, data: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to load roles (${response.status})`);
  }

  const payload = (await response.json()) as RolesApiResponse;
  return { status: 200, data: payload };
}

export default async function AdminRolesPage() {
  const staffUser = await getStaffUser();

  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return (
      <AppShell sidebar={<Sidebar />}>
        <Box py="9">
          <AccessDeniedNotice />
        </Box>
      </AppShell>
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

  let rolesResult: FetchRolesResult;

  try {
    rolesResult = await fetchRoles(baseUrl, headerEmail);
  } catch (error) {
    console.error('failed to load roles', error);
    return (
      <AppShell sidebar={<Sidebar />}>
        <PageHeader
          title="Roles"
          subtitle="Manage privileged assignments for staff."
          actions={(
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Signed in as {staffUser.displayName} ({staffUser.email})
              </Text>
              <ScrollToSectionButton targetId="assign-role" label="Assign role" />
            </Flex>
          )}
        />
        <Callout.Root color="crimson" role="alert">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Callout.Text>Unable to load role assignments. Try again shortly.</Callout.Text>
            <Button color="crimson" variant="soft" asChild>
              <Link href="/admin/roles">Retry</Link>
            </Button>
          </Flex>
        </Callout.Root>
      </AppShell>
    );
  }

  if (rolesResult.status === 401 || rolesResult.status === 403 || !rolesResult.data) {
    return (
      <AppShell sidebar={<Sidebar />}>
        <Box py="9">
          <AccessDeniedNotice />
        </Box>
      </AppShell>
    );
  }

  const data = rolesResult.data;
  const headerActions = (
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" color="gray">
        Signed in as {staffUser.displayName} ({staffUser.email})
      </Text>
      <ScrollToSectionButton targetId="assign-role" label="Assign role" />
    </Flex>
  );

  return (
    <AppShell sidebar={<Sidebar />}>
      <PageHeader
        title="Roles"
        subtitle="Manage privileged assignments for staff."
        actions={headerActions}
      />

      <RoleManager roles={data.roles} members={data.members} />
    </AppShell>
  );
}
