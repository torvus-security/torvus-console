import { z } from 'zod';
import { createSupabaseServiceRoleClient } from '../supabase';

const AUDIT_RELATIONS = ['console_audit_events', 'audit_events'] as const;

const AuditRowSchema = z.object({
  id: z.union([z.string(), z.number()]).optional().nullable(),
  ts: z.union([z.string(), z.date()]).optional().nullable(),
  actor_email: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  target_type: z.string().optional().nullable(),
  target_id: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  meta: z.unknown().optional().nullable()
});

type AuditRow = z.infer<typeof AuditRowSchema>;

export type AuditEvent = {
  id: string;
  occurredAt: string | null;
  actorEmail: string | null;
  action: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  meta: unknown | null;
};

function coerceLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit ?? NaN)) {
    return fallback;
  }

  const value = Math.floor(limit ?? fallback);
  if (value <= 0) {
    return fallback;
  }

  return value;
}

function normaliseRow(row: AuditRow, index: number): AuditEvent {
  const idValue = row.id;
  const occurredAtValue = row.ts;

  return {
    id: typeof idValue === 'number' ? String(idValue) : idValue ?? `row-${index}`,
    occurredAt:
      occurredAtValue instanceof Date
        ? occurredAtValue.toISOString()
        : typeof occurredAtValue === 'string'
        ? occurredAtValue
        : null,
    actorEmail: row.actor_email ?? null,
    action: row.action ?? null,
    targetType: row.target_type ?? null,
    targetId: row.target_id ?? null,
    ip: row.ip ?? null,
    meta: row.meta ?? null
  };
}

export async function listAuditEvents(limit = 200): Promise<AuditEvent[]> {
  const supabase = createSupabaseServiceRoleClient();
  const finalLimit = coerceLimit(limit, 200);

  for (const relation of AUDIT_RELATIONS) {
    try {
      const { data, error } = await (supabase
        .from(relation) as any)
        .select('id, ts, actor_email, action, target_type, target_id, ip, meta')
        .order('ts', { ascending: false, nullsFirst: false })
        .limit(finalLimit);

      if (error) {
        if (error.code === '42P01') {
          console.warn(`[audit] relation "${relation}" missing, checking fallback`);
          continue;
        }

        console.error(`[audit] failed to list events from ${relation}`, error);
        return [];
      }

      const rows = Array.isArray(data) ? data : [];
      const parsed: AuditEvent[] = [];

      rows.forEach((row, index) => {
        const result = AuditRowSchema.safeParse(row);
        if (!result.success) {
          console.warn('[audit] skipping row due to validation error', result.error.flatten());
          return;
        }

        parsed.push(normaliseRow(result.data, index));
      });

      return parsed;
    } catch (error: any) {
      if (error?.code === '42P01') {
        console.warn(`[audit] relation "${relation}" missing (caught)`, error?.message ?? error);
        continue;
      }

      console.error('[audit] unexpected error loading events', error);
      return [];
    }
  }

  return [];
}
