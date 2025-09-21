import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '../../../../lib/auth';
import { fetchAuditEvents } from '../../../../server/audit-data';
import { DEFAULT_RANGE, resolveRange, type RangeKey } from '../../../../server/audit-filters';

const RangeSchema = z.enum(['24h', '7d', '30d', 'custom']);

const QuerySchema = z.object({
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  range: RangeSchema.optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  action: z.string().optional(),
  actor: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireStaff({ permission: 'audit.read' });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 403;
    const message = typeof error?.message === 'string' ? error.message : 'forbidden';
    return NextResponse.json({ error: message }, { status });
  }

  const url = new URL(request.url);
  const queryObject = Object.fromEntries(url.searchParams.entries());

  const parsed = QuerySchema.safeParse(queryObject);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query parameters' }, { status: 400 });
  }

  const rangeKey = (parsed.data.range ?? DEFAULT_RANGE) as RangeKey;
  const resolvedRange = resolveRange(rangeKey, parsed.data.start, parsed.data.end);

  try {
    const { events, page, hasMore } = await fetchAuditEvents({
      limit: parsed.data.limit ?? 50,
      page: parsed.data.page ?? 0,
      start: resolvedRange.start,
      end: resolvedRange.end,
      action: parsed.data.action ?? null,
      actor: parsed.data.actor ?? null,
      targetType: parsed.data.targetType ?? null,
      targetId: parsed.data.targetId ?? null
    });

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        happenedAt: event.happenedAt,
        action: event.action,
        actorEmail: event.actorEmail,
        actorRoles: event.actorRoles,
        actorDisplayName: event.actorDisplayName,
        targetType: event.targetType,
        targetId: event.targetId,
        resource: event.resource,
        ip: event.ip,
        userAgent: event.userAgent,
        meta: event.meta
      })),
      page,
      hasMore,
      range: { start: resolvedRange.start, end: resolvedRange.end, key: resolvedRange.key }
    });
  } catch (error) {
    console.error('[api/audit/list] failed to load events', error);
    return NextResponse.json({ error: 'failed to load audit events' }, { status: 500 });
  }
}
