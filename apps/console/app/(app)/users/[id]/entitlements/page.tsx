import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../components/navigation/page-header';
import { loadAuthz, authorizeRoles } from '../../../../(lib)/authz';
import { DeniedPanel } from '../../../../(lib)/denied-panel';
import { isAdminSession } from '../../../../../lib/auth';
import {
  CAPABILITY_KEYS,
  PLAN_KEYS,
  getEntitlements,
  getUserById
} from '../../../../../server/entitlements';
import { fetchAuditEvents } from '../../../../../server/audit-data';
import { EntitlementsPanel } from './EntitlementsPanel';

export const dynamic = 'force-dynamic';

type EntitlementsPageProps = {
  params: {
    id: string;
  };
};

type DisplayAuditEvent = {
  id: string;
  happenedAt: string;
  actor: string;
  action: string;
  details: string;
};

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function describeAction(action: string, meta: unknown): string {
  const data = (meta && typeof meta === 'object' ? meta : null) as Record<string, unknown> | null;

  switch (action) {
    case 'plan.updated': {
      const plan = data?.plan_key ?? 'unknown';
      return `Plan updated to ${String(plan)}`;
    }
    case 'capability.updated': {
      const capability = data?.capability ?? 'capability';
      const operation = data?.op === 'revoke' ? 'revoked' : 'granted';
      return `${operation.charAt(0).toUpperCase()}${operation.slice(1)} ${String(capability)} capability`;
    }
    case 'journalist.archive_all':
      return 'Journalist access disabled and cases archived';
    case 'journalist.restore_all':
      return 'Journalist access restored and cases reopened';
    default:
      return action;
  }
}

function buildAuditDisplay(events: Awaited<ReturnType<typeof fetchAuditEvents>>['events']): DisplayAuditEvent[] {
  return events.map((event) => ({
    id: event.id,
    happenedAt: formatTimestamp(event.happenedAt),
    actor: event.actorEmail ?? 'System',
    action: event.action,
    details: describeAction(event.action, event.meta)
  }));
}

export default async function UserEntitlementsPage({ params }: EntitlementsPageProps) {
  const userId = params.id;
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const hasAdminRole = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'user-entitlements'
  });

  if (!hasAdminRole) {
    return <DeniedPanel message="You need the security administrator role to manage user entitlements." />;
  }

  let hasAdminSession = false;

  try {
    hasAdminSession = await isAdminSession();
  } catch (error) {
    console.error('[users][entitlements] failed to verify is_admin()', error);
    return <DeniedPanel message="Unable to verify Supabase administrator privileges at this time." />;
  }

  if (!hasAdminSession) {
    return <DeniedPanel message="Supabase administrator privileges are required to manage user entitlements." />;
  }

  const user = await getUserById(userId);

  if (!user) {
    return notFound();
  }

  const entitlements = await getEntitlements(userId);
  const planKey = entitlements.plan?.plan_key ?? 'free';
  const planSetAt = entitlements.plan?.set_at ?? null;
  const planSetBy = entitlements.plan?.set_by ?? null;

  const capabilityGrants = entitlements.grants
    .filter((grant) => typeof grant.capability === 'string' && CAPABILITY_KEYS.includes(grant.capability as (typeof CAPABILITY_KEYS)[number]))
    .map((grant) => ({
      capability: grant.capability,
      grantedAt: grant.granted_at,
      grantedBy: grant.granted_by
    }));

  const { events } = await fetchAuditEvents({
    limit: 20,
    page: 0,
    targetType: 'user.entitlements',
    targetId: userId
  });

  const auditEvents = buildAuditDisplay(events);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage entitlements"
        subtitle={`Adjust plans and capabilities for ${user.email}.`}
      />

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <dl className="grid gap-4 sm:grid-cols-3 sm:gap-6 text-sm text-slate-300">
          <div>
            <dt className="font-medium text-slate-200">Email</dt>
            <dd className="mt-1 break-all text-slate-100">{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-200">User ID</dt>
            <dd className="mt-1 break-all text-slate-400">{user.user_id}</dd>
          </div>
          {user.full_name ? (
            <div>
              <dt className="font-medium text-slate-200">Name</dt>
              <dd className="mt-1 text-slate-100">{user.full_name}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <EntitlementsPanel
        userId={user.user_id}
        planKey={planKey}
        planSetAt={planSetAt}
        planSetBy={planSetBy}
        planOptions={PLAN_KEYS}
        capabilityOptions={CAPABILITY_KEYS}
        capabilityGrants={capabilityGrants}
      />

      <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-inner shadow-black/20">
        <header className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Recent audit entries</h2>
          <p className="text-sm text-slate-400">Changes scoped to user entitlements are logged for accountability.</p>
        </header>
        {auditEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No audit entries recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {auditEvents.map((event) => (
              <li key={event.id} className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
                <p className="text-sm font-medium text-slate-100">{event.details}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {event.happenedAt} — {event.actor}
                </p>
                <p className="mt-1 text-xs text-slate-600">Action: {event.action}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
