import { cookies, headers } from 'next/headers';

type ApiCallOptions = Omit<RequestInit, 'headers'> & { headers?: HeadersInit };

type ApiResponse<T> = {
  status: number;
  data: T | null;
};

function resolveBaseUrl(): { baseUrl: string; emailHeader: string | null; cookieHeader: string | null } {
  const headerBag = headers();
  const host = headerBag.get('x-forwarded-host') ?? headerBag.get('host');
  const protoHeader = headerBag.get('x-forwarded-proto');

  let baseUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3000';

  if (host) {
    const normalisedHost = host.toLowerCase();
    const defaultProto = normalisedHost.includes('localhost') || normalisedHost.includes('127.0.0.1') ? 'http' : 'https';
    const protocol = protoHeader ?? defaultProto;
    baseUrl = `${protocol}://${host}`;
  }

  const headerEmail =
    headerBag.get('x-authenticated-staff-email')
    ?? headerBag.get('x-session-user-email');

  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  return { baseUrl, emailHeader: headerEmail, cookieHeader: cookieHeader || null };
}

export async function callReleasesApi<T>(path: string, options: ApiCallOptions = {}): Promise<ApiResponse<T>> {
  const { baseUrl, emailHeader, cookieHeader } = resolveBaseUrl();

  const headersMap = new Headers(options.headers);
  if (cookieHeader) {
    headersMap.set('cookie', cookieHeader);
  }
  if (emailHeader) {
    headersMap.set('x-authenticated-staff-email', emailHeader);
  }
  headersMap.set('accept', 'application/json');

  const response = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    ...options,
    headers: headersMap
  });

  let data: T | null = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = (await response.json()) as T;
  }

  return { status: response.status, data };
}
