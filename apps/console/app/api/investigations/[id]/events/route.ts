import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAudit } from '../../../../../server/audit';
import { getInvestigationById, type InvestigationEvent } from '../../../../../lib/data/investigations';
import { resolveViewer, canManageInvestigations, canViewInvestigations } from '../../utils';

const noteSchema = z.object({
  message: z.string().min(1).max(2000)
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  const investigation = await getInvestigationById(params.id);
  if (!investigation) {
    return new Response('not found', { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.errors[0]?.message ?? 'invalid payload', { status: 400 });
  }

  const message = parsed.data.message.trim();

  const { data: insertedRows, error: insertError } = await (supabase.from('investigation_events') as any)
    .insert({
      investigation_id: params.id,
      actor_user_id: staff.user_id,
      kind: 'note',
      message,
      meta: {}
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to insert investigation note', insertError);
    return new Response('failed to add note', { status: 500 });
  }

  const eventId = (insertedRows as { id: string }).id;

  const { data: eventRows, error: selectError } = await (supabase.from('investigation_events_with_actor') as any)
    .select('id, investigation_id, created_at, actor_user_id, kind, message, meta, actor_email, actor_display_name')
    .eq('id', eventId)
    .maybeSingle();

  if (selectError) {
    console.error('Failed to load inserted note', selectError);
    return new Response('failed to load note', { status: 500 });
  }

  const row = eventRows as any;
  const event: InvestigationEvent = {
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
  };

  await logAudit(
    {
      action: 'investigation_note_added',
      targetType: 'investigation',
      targetId: params.id,
      resource: 'console.investigations',
      meta: {
        message_length: message.length
      }
    },
    request
  );

  return NextResponse.json({ event }, { status: 201 });
}
