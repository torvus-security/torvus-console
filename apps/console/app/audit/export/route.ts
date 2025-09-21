import { headers } from 'next/headers';
import { requireStaff } from '../../../lib/auth';
import { getAnalyticsClient } from '../../../lib/analytics';
import { listAuditEvents } from '../../../lib/data/audit';

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

export async function GET() {
  const staffUser = await requireStaff();
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const events = await listAuditEvents();

  if (events.length === 0) {
    return new Response(null, { status: 204 });
  }

  const headerRow = 'id,ts,actor_email,action,target_type,target_id,ip,meta';
  const dataRows = events.map((event) => {
    const cells = [
      event.id,
      normaliseTimestamp(event.occurredAt),
      event.actorEmail ?? '',
      event.action ?? '',
      event.targetType ?? '',
      event.targetId ?? '',
      event.ip ?? '',
      serialiseMeta(event.meta)
    ];

    return cells.map((cell) => escapeCsv(cell)).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');
  const now = new Date();
  const filename = buildFilename(now);

  const analytics = getAnalyticsClient();
  analytics.capture('audit_events_exported', {
    user: staffUser.analyticsId,
    count: events.length,
    correlation_id: correlationId,
    env: process.env.NODE_ENV ?? 'development'
  });

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
