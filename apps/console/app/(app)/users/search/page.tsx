import Link from 'next/link';
import { PageHeader } from '../../../../components/navigation/page-header';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { loadAuthz, authorizeRoles } from '../../../(lib)/authz';
import { DeniedPanel } from '../../../(lib)/denied-panel';
import { isAdminSession } from '../../../../lib/auth';
import { getUserByEmail } from '../../../../server/entitlements';

export const dynamic = 'force-dynamic';

type SearchPageProps = {
  searchParams?: Record<string, string | string[]>;
};

function normaliseQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return normaliseQuery(value[0]);
  }
  return typeof value === 'string' ? value.trim() : '';
}

export default async function UsersSearchPage({ searchParams }: SearchPageProps) {
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const hasAdminRole = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'users-search'
  });

  if (!hasAdminRole) {
    return <DeniedPanel message="You need the security administrator role to manage user entitlements." />;
  }

  let hasAdminSession = false;

  try {
    hasAdminSession = await isAdminSession();
  } catch (error) {
    console.error('[users][search] failed to verify is_admin()', error);
    return <DeniedPanel message="Unable to verify Supabase administrator privileges at this time." />;
  }

  if (!hasAdminSession) {
    return <DeniedPanel message="Supabase administrator privileges are required to manage user entitlements." />;
  }

  const query = normaliseQuery(searchParams?.q);
  let user: Awaited<ReturnType<typeof getUserByEmail>> | null = null;
  let lookupError: string | null = null;

  if (query) {
    try {
      user = await getUserByEmail(query);
      if (!user) {
        lookupError = `No user found for ${query}.`;
      }
    } catch (error) {
      console.error('[users][search] lookup failed', error);
      lookupError = 'Failed to look up the requested user.';
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="User entitlements"
        subtitle="Search for a platform account and manage plan & capability assignments."
      />

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="get">
          <div className="flex-1 space-y-2">
            <label htmlFor="user-email" className="text-sm font-medium text-slate-200">
              Email address
            </label>
            <Input
              id="user-email"
              name="q"
              type="email"
              placeholder="staff.member@example.com"
              defaultValue={query}
              required
              className="max-w-xl"
            />
          </div>
          <Button type="submit" variant="solid" className="w-full sm:w-auto">
            Search
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Search requires the exact email address the user uses to sign in to the platform.
        </p>
      </section>

      {query ? (
        <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/10">
          {lookupError ? (
            <p className="text-sm text-rose-300">{lookupError}</p>
          ) : user ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{user.email}</h2>
                {user.full_name ? (
                  <p className="text-sm text-slate-400">{user.full_name}</p>
                ) : null}
                <p className="text-xs text-slate-500">User ID: {user.user_id}</p>
              </div>
              <div>
                <Link
                  href={`/users/${encodeURIComponent(user.user_id)}/entitlements`}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-600/40"
                >
                  Open entitlements
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
