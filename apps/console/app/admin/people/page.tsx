import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { Box, Button, Callout, Flex, Text } from '@radix-ui/themes';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { AppShell } from '../../../components/AppShell';
import { Sidebar } from '../../../components/Sidebar';
import { PageHeader } from '../../../components/PageHeader';
import { InviteStaffButton } from '../../../components/actions/InviteStaffButton';
import { PeopleTable, type AdminPersonRecord } from '../../../components/admin/PeopleTable';
import { getStaffUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

type FetchPeopleResult =
  | { status: 401 | 403; people: null }
  | { status: 200; people: AdminPersonRecord[] };

async function fetchPeople(baseUrl: string, emailHeader: string | null): Promise<FetchPeopleResult> {
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

  const response = await fetch(`${baseUrl}/api/admin/people`, {
    cache: 'no-store',
    headers: headersMap
  });

  if (response.status === 401 || response.status === 403) {
    return { status: response.status as 401 | 403, people: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to load staff directory (${response.status})`);
  }

  const people = (await response.json()) as AdminPersonRecord[];
  return { status: 200, people };
}

export default async function AdminPeoplePage() {
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

  let peopleResult: FetchPeopleResult;

  try {
    peopleResult = await fetchPeople(baseUrl, headerEmail);
  } catch (error) {
    console.error('failed to load staff directory', error);
    return (
      <AppShell sidebar={<Sidebar />}>
        <PageHeader
          title="People"
          subtitle="Security administrators enrolled in Torvus Console."
          actions={(
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Signed in as {staffUser.displayName} ({staffUser.email})
              </Text>
              <InviteStaffButton />
            </Flex>
          )}
        />
        <Callout.Root color="crimson" role="alert">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Callout.Text>Unable to load the staff directory. Try again shortly.</Callout.Text>
            <Button color="crimson" variant="soft" asChild>
              <Link href="/admin/people">Retry</Link>
            </Button>
          </Flex>
        </Callout.Root>
      </AppShell>
    );
  }

  if (peopleResult.status === 401 || peopleResult.status === 403 || !peopleResult.people) {
    return (
      <AppShell sidebar={<Sidebar />}>
        <Box py="9">
          <AccessDeniedNotice />
        </Box>
      </AppShell>
    );
  }

  const people = peopleResult.people;
  const headerActions = (
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" color="gray">
        Signed in as {staffUser.displayName} ({staffUser.email})
      </Text>
      <InviteStaffButton />
    </Flex>
  );

  return (
    <AppShell sidebar={<Sidebar />}>
      <PageHeader
        title="People"
        subtitle="Security administrators enrolled in Torvus Console."
        actions={headerActions}
      />

      {people.length === 0 ? (
        <Callout.Root color="gray" role="status">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Callout.Text>No staff have been added yet. Invite a teammate to get started.</Callout.Text>
            <InviteStaffButton />
          </Flex>
        </Callout.Root>
      ) : (
        <PeopleTable people={people} />
      )}
    </AppShell>
  );
}
