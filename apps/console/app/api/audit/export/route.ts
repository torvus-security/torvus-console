import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '../../../../lib/auth';
import { getAnalyticsClient } from '../../../../lib/analytics';
import { fetchAuditEvents } from '../../../../server/audit-data';
import { DEFAULT_RANGE, resolveRange, type RangeKey } from '../../../../server/audit-filters';
import { logAudit } from '../../../../server/audit';

const RangeSchema = z.enum(['24h', '7d', '30d', 'custom']);

const QuerySchema = z.object({
  range: RangeSchema.optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  action: z.string().optional(),
  actor: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional()
});

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function buildFilename(now: Date): string {
  return `audit-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}.csv`;
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normaliseTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toISOString();
}

function serialiseMeta(meta: unknown): string {
  if (meta === null || typeof meta === 'undefined') {
    return '';
  }
  if (typeof meta === 'string') {
    return meta;
  }
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

export const runtime = 'nodejs';

export async function GET(request: Request) {
  let staffUser;
  try {
    staffUser = await requireStaff({ permission: 'audit.export' });
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

  const encoder = new TextEncoder();
  const now = new Date();
  const filename = buildFilename(now);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode('id,happened_at,actor_email,actor_roles,action,target_type,target_id,resource,ip,user_agent,meta\n')
      );

      let page = 0;
      let total = 0;
      const limit = 500;

      try {
        while (true) {
          const { events, hasMore } = await fetchAuditEvents({
            limit,
            page,
            start: resolvedRange.start,
            end: resolvedRange.end,
            action: parsed.data.action ?? null,
            actor: parsed.data.actor ?? null,
            targetType: parsed.data.targetType ?? null,
            targetId: parsed.data.targetId ?? null
          });

          if (events.length === 0) {
            break;
          }

          total += events.length;

          for (const event of events) {
            const cells = [
              event.id,
              normaliseTimestamp(event.happenedAt),
              event.actorEmail ?? '',
              event.actorRoles.join(';'),
              event.action,
              event.targetType ?? '',
              event.targetId ?? '',
              event.resource ?? '',
              event.ip ?? '',
              event.userAgent ?? '',
              serialiseMeta(event.meta)
            ];
            controller.enqueue(encoder.encode(`${cells.map((cell) => escapeCsv(cell)).join(',')}\n`));
          }

          if (!hasMore) {
            break;
          }

          page += 1;
        }

        const analytics = getAnalyticsClient();
        analytics.capture('audit_events_exported', {
          user: staffUser.analyticsId,
          count: total,
          env: process.env.NODE_ENV ?? 'development'
        });

        await logAudit(
          {
            action: 'audit_export',
            targetType: 'audit_events',
            targetId: resolvedRange.key,
            resource: 'console.audit',
            meta: {
              count: total,
              action: parsed.data.action ?? null,
              actor: parsed.data.actor ?? null,
              targetType: parsed.data.targetType ?? null,
              targetId: parsed.data.targetId ?? null,
              range_start: resolvedRange.start,
              range_end: resolvedRange.end
            }
          },
          request
        );
      } catch (error) {
        console.error('[api/audit/export] failed to stream audit events', error);
        controller.error(error);
        return;
      }

      controller.close();
    }
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'x-audit-range-start': resolvedRange.start ?? '',
      'x-audit-range-end': resolvedRange.end ?? ''
    }
  });
}
