import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAudit, type AuditLogInput } from '../../../../server/audit';
import {
  INVESTIGATION_SEVERITIES,
  INVESTIGATION_STATUSES
} from '../../../../lib/investigations/constants';
import { getInvestigationById, type InvestigationEvent } from '../../../../lib/data/investigations';
import {
  resolveViewer,
  canManageInvestigations,
  canViewInvestigations,
  loadStaffSummaries
} from '../utils';

const updateSchema = z
  .object({
    title: z.string().optional(),
    status: z.enum(INVESTIGATION_STATUSES).optional(),
    severity: z.enum(INVESTIGATION_SEVERITIES).optional(),
    assignedTo: z.union([z.string(), z.null()]).optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'no fields provided' });

const uuidSchema = z.string().uuid();

type InvestigationRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  assigned_to: string | null;
  summary: string | null;
  tags: string[] | null;
};

function normaliseTags(input: string[] | undefined): string[] {
  if (!input) {
    return [];
  }
  const unique = new Set<string>();
  for (const tag of input) {
    const trimmed = tag.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
}

function safeJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const viewer = await resolveViewer(request);
  if (viewer.type === 'error') {
    return viewer.response;
  }

  const { supabase, staff, roles } = viewer;

  if (!canViewInvestigations(roles)) {
    return new Response('forbidden', { status: 403 });
  }

  if (!canManageInvestigations(roles) || !staff) {
    return new Response('forbidden', { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.errors[0]?.message ?? 'invalid payload', { status: 400 });
  }

  const payload = parsed.data;

  const { data: currentRow, error: fetchError } = await (supabase.from('investigations') as any)
    .select('id, title, status, severity, assigned_to, summary, tags')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to load investigation for update', fetchError);
    return new Response('failed to load investigation', { status: 500 });
  }

  if (!currentRow) {
    return new Response('not found', { status: 404 });
  }

  const current = currentRow as InvestigationRow;

  const updates: Record<string, unknown> = {};
  const eventsToInsert: Array<{
    kind: 'note' | 'status_change' | 'assignment_change' | 'attachment';
    message: string | null;
    meta: Record<string, unknown>;
  }> = [];
  const auditEntries: AuditLogInput[] = [];

  if (payload.title !== undefined) {
    const trimmed = payload.title.trim();
    if (!trimmed) {
      return new Response('title cannot be empty', { status: 400 });
    }
    if (trimmed !== current.title) {
      updates.title = trimmed;
      eventsToInsert.push({
        kind: 'note',
        message: 'Title updated',
        meta: {
          from: current.title,
          to: trimmed
        }
      });
      auditEntries.push({
        action: 'investigation_title_update',
        targetType: 'investigation',
        targetId: params.id,
        resource: 'console.investigations',
        meta: { from: current.title, to: trimmed }
      });
    }
  }

  if (payload.status && payload.status !== current.status) {
    updates.status = payload.status;
    eventsToInsert.push({
      kind: 'status_change',
      message: `Status changed to ${payload.status.replace('_', ' ')}`,
      meta: {
        from: current.status,
        to: payload.status
      }
    });
    auditEntries.push({
      action: 'investigation_status_change',
      targetType: 'investigation',
      targetId: params.id,
      resource: 'console.investigations',
      meta: { from: current.status, to: payload.status }
    });
  }

  if (payload.severity && payload.severity !== current.severity) {
    updates.severity = payload.severity;
    eventsToInsert.push({
      kind: 'note',
      message: `Severity changed to ${payload.severity}`,
      meta: {
        from: current.severity,
        to: payload.severity
      }
    });
    auditEntries.push({
      action: 'investigation_severity_change',
      targetType: 'investigation',
      targetId: params.id,
      resource: 'console.investigations',
      meta: { from: current.severity, to: payload.severity }
    });
  }

  if (payload.assignedTo !== undefined) {
    let nextAssignee: string | null;
    if (payload.assignedTo === null || payload.assignedTo === '') {
      nextAssignee = null;
    } else {
      const trimmed = payload.assignedTo.trim();
      const parsedAssignee = uuidSchema.safeParse(trimmed);
      if (!parsedAssignee.success) {
        return new Response('invalid assignee id', { status: 400 });
      }
      nextAssignee = parsedAssignee.data;
    }

    if (nextAssignee !== (current.assigned_to ?? null)) {
      updates.assigned_to = nextAssignee;

      let message = 'Assignment updated';
      try {
        const summaries = await loadStaffSummaries(supabase, [current.assigned_to, nextAssignee]);
        const nextSummary = nextAssignee ? summaries.get(nextAssignee) : null;
        const fromSummary = current.assigned_to ? summaries.get(current.assigned_to) : null;
        const fromLabel = fromSummary?.display_name ?? fromSummary?.email ?? current.assigned_to ?? 'Unassigned';
        const toLabel = nextSummary?.display_name ?? nextSummary?.email ?? (nextAssignee ?? 'Unassigned');
        message = nextAssignee ? `Assigned to ${toLabel}` : 'Unassigned';
        eventsToInsert.push({
          kind: 'assignment_change',
          message,
          meta: {
            from_user_id: current.assigned_to,
            from_label: fromLabel,
            to_user_id: nextAssignee,
            to_label: toLabel
          }
        });
      } catch (summaryError) {
        console.warn('Failed to resolve staff summary for assignment change', summaryError);
        eventsToInsert.push({
          kind: 'assignment_change',
          message: nextAssignee ? 'Assignment updated' : 'Unassigned',
          meta: {
            from_user_id: current.assigned_to,
            to_user_id: nextAssignee
          }
        });
      }

      auditEntries.push({
        action: 'investigation_assignment_change',
        targetType: 'investigation',
        targetId: params.id,
        resource: 'console.investigations',
        meta: {
          from: current.assigned_to,
          to: nextAssignee
        }
      });
    }
  }

  if (payload.summary !== undefined) {
    const trimmed = payload.summary.trim();
    const canonical = current.summary ?? '';
    if (trimmed !== canonical) {
      updates.summary = trimmed ? trimmed : null;
      eventsToInsert.push({
        kind: 'note',
        message: 'Summary updated',
        meta: {
          previous: canonical,
          next: trimmed
        }
      });
      auditEntries.push({
        action: 'investigation_summary_update',
        targetType: 'investigation',
        targetId: params.id,
        resource: 'console.investigations',
        meta: {
          previous: canonical,
          next: trimmed
        }
      });
    }
  }

  if (payload.tags !== undefined) {
    const nextTags = normaliseTags(payload.tags);
    const currentTags = Array.isArray(current.tags) ? current.tags : [];
    if (!safeJsonEqual(nextTags, currentTags)) {
      updates.tags = nextTags;
      eventsToInsert.push({
        kind: 'note',
        message: 'Tags updated',
        meta: {
          previous: currentTags,
          next: nextTags
        }
      });
      auditEntries.push({
        action: 'investigation_tags_update',
        targetType: 'investigation',
        targetId: params.id,
        resource: 'console.investigations',
        meta: {
          previous: currentTags,
          next: nextTags
        }
      });
    }
  }

  if (Object.keys(updates).length === 0 && eventsToInsert.length === 0) {
    const investigation = await getInvestigationById(params.id);
    return NextResponse.json({ investigation });
  }

  const { error: updateError } = await (supabase.from('investigations') as any)
    .update(updates)
    .eq('id', params.id);

  if (updateError) {
    console.error('Failed to update investigation', updateError);
    return new Response('failed to update investigation', { status: 500 });
  }

  let newEvents: InvestigationEvent[] = [];

  if (eventsToInsert.length > 0) {
    const payloadToInsert = eventsToInsert.map((event) => ({
      investigation_id: params.id,
      actor_user_id: staff.user_id,
      kind: event.kind,
      message: event.message,
      meta: event.meta
    }));

    const { data: insertedRows, error: insertError } = await (supabase.from('investigation_events') as any)
      .insert(payloadToInsert)
      .select('id');

    if (insertError) {
      console.error('Failed to record investigation events', insertError);
    } else {
      const ids = ((insertedRows as Array<{ id: string }> | null) ?? []).map((row) => row.id);
      if (ids.length) {
        const { data: eventRows, error: selectError } = await (supabase.from('investigation_events_with_actor') as any)
          .select('id, investigation_id, created_at, actor_user_id, kind, message, meta, actor_email, actor_display_name')
          .in('id', ids)
          .order('created_at', { ascending: false });

        if (selectError) {
          console.error('Failed to load inserted events', selectError);
        } else {
          newEvents = ((eventRows as any[]) ?? []).map((row) => ({
            id: row.id,
            investigationId: row.investigation_id,
            createdAt: row.created_at,
            actor: {
              id: row.actor_user_id ?? null,
              email: row.actor_email ?? null,
              displayName: row.actor_display_name ?? null
            },
            kind: row.kind,
            message: row.message ?? null,
            meta: row.meta ?? {}
          }));
        }
      }
    }
  }

  const investigation = await getInvestigationById(params.id);

  if (!investigation) {
    return new Response('failed to load updated investigation', { status: 500 });
  }

  for (const entry of auditEntries) {
    try {
      await logAudit(entry, request);
    } catch (auditError) {
      console.error('Failed to write audit log', auditError);
    }
  }

  return NextResponse.json({ investigation, events: newEvents });
}
