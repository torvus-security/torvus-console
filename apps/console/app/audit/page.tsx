import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { requireStaff } from '../../lib/auth';
import { getAnalyticsClient } from '../../lib/analytics';
import { AuditClient } from './AuditClient';
import { fetchAuditEvents, fetchDistinctActions, fetchDistinctTargetTypes } from '../../server/audit-data';
import { DEFAULT_RANGE, resolveRange, type RangeKey } from '../../server/audit-filters';
import { logAudit } from '../../server/audit';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Audit trail — Torvus Console'
};

type SearchParams = {
  range?: string | string[];
  start?: string | string[];
  end?: string | string[];
  action?: string | string[];
  actor?: string | string[];
  targetType?: string | string[];
  targetId?: string | string[];
};

function pickString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

export default async function AuditPage({ searchParams }: { searchParams?: SearchParams }) {
  const staffUser = await requireStaff({ permission: 'audit.read' });
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();

  const rangeParam = pickString(searchParams?.range) as RangeKey | null;
  const startParam = pickString(searchParams?.start);
  const endParam = pickString(searchParams?.end);
  const actionParam = pickString(searchParams?.action);
  const actorParam = pickString(searchParams?.actor);
  const targetTypeParam = pickString(searchParams?.targetType);
  const targetIdParam = pickString(searchParams?.targetId);

  const resolvedRange = resolveRange(rangeParam ?? DEFAULT_RANGE, startParam, endParam);

  const pageSize = 50;

  const [initialData, actions, targetTypes] = await Promise.all([
    fetchAuditEvents({
      limit: pageSize,
      page: 0,
      start: resolvedRange.start,
      end: resolvedRange.end,
      action: actionParam,
      actor: actorParam,
      targetType: targetTypeParam,
      targetId: targetIdParam
    }).catch((error) => {
      console.error('[audit] failed to load initial events', error);
      return { events: [], page: 0, hasMore: false };
    }),
    fetchDistinctActions().catch((error) => {
      console.error('[audit] failed to load distinct actions', error);
      return [] as string[];
    }),
    fetchDistinctTargetTypes().catch((error) => {
      console.error('[audit] failed to load distinct target types', error);
      return [] as string[];
    })
  ]);

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/audit',
    user: staffUser.analyticsId,
    env: process.env.NODE_ENV ?? 'development',
    correlation_id: correlationId
  });

  await logAudit({
    action: 'page_view',
    targetType: 'page',
    targetId: 'audit',
    resource: 'console.audit',
    meta: {
      range_key: resolvedRange.key,
      action: actionParam,
      actor: actorParam,
      target_type: targetTypeParam,
      target_id: targetIdParam
    }
  });

  return (
    <div className="page">
      <section className="panel" aria-labelledby="audit-heading">
        <AuditClient
          initialEvents={initialData.events}
          initialHasMore={initialData.hasMore}
          defaultFilters={{
            range: resolvedRange.key,
            start: resolvedRange.start,
            end: resolvedRange.end,
            action: actionParam,
            actor: actorParam,
            targetType: targetTypeParam,
            targetId: targetIdParam
          }}
          availableActions={actions}
          availableTargetTypes={targetTypes}
          pageSize={pageSize}
        />
      </section>
    </div>
  );
}
