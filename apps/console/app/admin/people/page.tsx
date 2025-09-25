import Link from 'next/link';
import { Suspense, use } from 'react';
import { cookies, headers } from 'next/headers';
import { Box, Button, Callout, Flex, Text } from '@radix-ui/themes';
import { PageHeader } from '../../../components/PageHeader';
import { InviteStaffButton } from '../../../components/actions/InviteStaffButton';
import { SkeletonBlock } from '../../../components/SkeletonBlock';
import { EmptyState } from '../../../components/EmptyState';
import { PeopleTable, type AdminPersonRecord } from '../../../components/admin/PeopleTable';
import { getStaffUser } from '../../../lib/auth';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

type FetchPeopleResult =
  | { status: 401 | 403; people: null }
  | { status: 200; people: AdminPersonRecord[] };

type PeopleDirectoryData =
  | { kind: 'success'; result: FetchPeopleResult }
  | { kind: 'error'; error: unknown };

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

function PeopleSkeleton() {
  return (
    <section
      className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock width="16rem" height="1.5rem" />
        <SkeletonBlock width="12rem" height="2.5rem" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800/60">
        <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {[0, 1, 2, 3].map((key) => (
                <th key={key} scope="col" className="px-6 py-3">
                  <SkeletonBlock width="6rem" height="1rem" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {Array.from({ length: 6 }).map((_, index) => (
              <tr key={index}>
                {Array.from({ length: 4 }).map((__unused, cellIndex) => (
                  <td key={cellIndex} className="px-6 py-4">
                    <SkeletonBlock height="1rem" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeopleDirectorySection({
  dataPromise
}: {
  dataPromise: Promise<PeopleDirectoryData>;
}) {
  const data = use(dataPromise);

  if (data.kind === 'error') {
    console.error('failed to load staff directory', data.error);
    return (
      <Callout.Root color="crimson" role="alert">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Callout.Text>Unable to load the staff directory. Try again shortly.</Callout.Text>
          <Button color="crimson" variant="soft" asChild>
            <Link href="/admin/people">Retry</Link>
          </Button>
        </Flex>
      </Callout.Root>
    );
  }

  const peopleResult = data.result;

  if (peopleResult.status === 401 || peopleResult.status === 403 || !peopleResult.people) {
    return (
      <Box py="9">
        <DeniedPanel message="You do not have permission to view the staff directory." />
      </Box>
    );
  }

  const people = peopleResult.people;

  if (people.length === 0) {
    return (
      <EmptyState
        title="Invite your first administrator"
        description="Share Torvus Console with a teammate to collaborate on investigations."
        action={<InviteStaffButton />}
      />
    );
  }

  return <PeopleTable people={people} />;
}

export default async function AdminPeoplePage() {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return (
      <Box py="9">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </Box>
    );
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'admin-people'
  });

  if (!isSecurityAdmin) {
    return (
      <Box py="9">
        <DeniedPanel message="You need the security administrator role to manage staff." />
      </Box>
    );
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <Box py="9">
        <DeniedPanel message="Unable to resolve your staff identity." />
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

  const headerActions = (
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" color="gray">
        Signed in as {staffUser.displayName} ({staffUser.email})
      </Text>
      <InviteStaffButton />
    </Flex>
  );

  const peopleDataPromise: Promise<PeopleDirectoryData> = (async () => {
    try {
      const result = await fetchPeople(baseUrl, headerEmail);
      return { kind: 'success', result } as const;
    } catch (error) {
      return { kind: 'error', error } as const;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="People"
        description="Security administrators enrolled in Torvus Console."
        actions={headerActions}
      />
      <Suspense fallback={<PeopleSkeleton />}>
        <PeopleDirectorySection dataPromise={peopleDataPromise} />
      </Suspense>
    </div>
  );
}
