import Link from 'next/link';
import { Suspense, use } from 'react';
import { cookies, headers } from 'next/headers';
import { Button, Callout, Flex, Text } from '@radix-ui/themes';
import { PageHeader } from '../../../../components/navigation/page-header';
import { ScrollToSectionButton } from '../../../../components/actions/ScrollToSectionButton';
import { SkeletonBlock } from '../../../../components/SkeletonBlock';
import { RoleManager, type RoleMemberRecord } from '../../../../components/admin/RoleManager';
import { getIdentityFromRequestHeaders, getStaffUser } from '../../../../lib/auth';
import { withRequiredRole } from '../../../../lib/with-authz';

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

type RolesDirectoryData =
  | { kind: 'success'; result: FetchRolesResult }
  | { kind: 'error'; error: unknown };

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
    headersMap.set('x-torvus-console-email', emailHeader);
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

function RolesSkeleton() {
  return (
    <section
      className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock width="18rem" height="1.5rem" />
        <SkeletonBlock width="12rem" height="2.5rem" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-800/70">
          <table className="min-w-full divide-y divide-slate-800/80 text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[0, 1, 2].map((key) => (
                  <th key={key} scope="col" className="px-6 py-3">
                    <SkeletonBlock width="6rem" height="1rem" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  {Array.from({ length: 3 }).map((__unused, cellIndex) => (
                    <td key={cellIndex} className="px-6 py-4">
                      <SkeletonBlock height="1rem" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-6">
          <SkeletonBlock width="10rem" height="1.25rem" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <SkeletonBlock width="5rem" height="1rem" />
                <SkeletonBlock width="100%" height="2.5rem" />
              </div>
            ))}
            <SkeletonBlock width="7rem" height="2.5rem" />
          </div>
        </aside>
      </div>
    </section>
  );
}

function RolesDirectorySection({
  dataPromise
}: {
  dataPromise: Promise<RolesDirectoryData>;
}) {
  const data = use(dataPromise);

  if (data.kind === 'error') {
    console.error('failed to load roles', data.error);
    return (
      <Callout.Root color="crimson" role="alert">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Callout.Text>Unable to load role assignments. Try again shortly.</Callout.Text>
          <Button color="crimson" variant="soft" asChild>
            <Link href="/admin/roles">Retry</Link>
          </Button>
        </Flex>
      </Callout.Root>
    );
  }

  const rolesResult = data.result;

  if (rolesResult.status !== 200 || !rolesResult.data) {
    console.warn('Unexpected admin roles response status', rolesResult.status);
    return (
      <Callout.Root color="crimson" role="alert">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Callout.Text>Unable to load role assignments. Try again shortly.</Callout.Text>
          <Button color="crimson" variant="soft" asChild>
            <Link href="/admin/roles">Retry</Link>
          </Button>
        </Flex>
      </Callout.Root>
    );
  }

  const payload = rolesResult.data;

  return <RoleManager roles={payload.roles} members={payload.members} />;
}

export default function AdminRolesPage() {
  return withRequiredRole(['security_admin'], async () => {
    const staffUser = await getStaffUser();

    if (!staffUser) {
      throw new Error('Staff user unavailable after authorization check');
    }

    const headerBag = headers();
    const host = headerBag.get('x-forwarded-host') ?? headerBag.get('host');
    const protoHeader = headerBag.get('x-forwarded-proto');

    let baseUrl: string;
    if (host) {
      const normalisedHost = host.toLowerCase();
      const defaultProto =
        normalisedHost.includes('localhost') || normalisedHost.includes('127.0.0.1') ? 'http' : 'https';
      const protocol = protoHeader ?? defaultProto;
      baseUrl = `${protocol}://${host}`;
    } else {
      baseUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3000';
    }

    const identity = getIdentityFromRequestHeaders(headerBag);
    const headerEmail = identity.email ?? staffUser.email;

    const headerActions = (
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-11">
        <span>
          Signed in as {staffUser.displayName} ({staffUser.email})
        </span>
        <ScrollToSectionButton targetId="assign-role" label="Assign role" />
      </div>
    );

    const rolesDataPromise: Promise<RolesDirectoryData> = (async () => {
      try {
        const result = await fetchRoles(baseUrl, headerEmail);
        return { kind: 'success', result } as const;
      } catch (error) {
        return { kind: 'error', error } as const;
      }
    })();

    return (
      <div className="space-y-6">
        <PageHeader
          title="Roles"
          subtitle="Manage privileged assignments for staff."
          actions={headerActions}
        />
        <Suspense fallback={<RolesSkeleton />}>
          <RolesDirectorySection dataPromise={rolesDataPromise} />
        </Suspense>
      </div>
    );
  });
}
