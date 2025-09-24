import { cookies, headers } from 'next/headers';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
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

  const { status, people } = await fetchPeople(baseUrl, headerEmail);

  if (status === 401 || status === 403) {
    return <AccessDeniedNotice />;
  }

  if (!people) {
    throw new Error('People payload missing');
  }

  return (
    <div className="page">
      <PeopleTable people={people} />
    </div>
  );
}
