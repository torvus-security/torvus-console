import { cookies, headers } from 'next/headers';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
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
    headerBag.get('x-authenticated-staff-email')
    ?? headerBag.get('x-session-user-email')
    ?? staffUser.email;

  const { status, data } = await fetchRoles(baseUrl, headerEmail);

  if (status === 401 || status === 403) {
    return <AccessDeniedNotice />;
  }

  if (!data) {
    throw new Error('Roles payload missing');
  }

  return (
    <div className="page">
      <RoleManager roles={data.roles} members={data.members} />
    </div>
  );
}
