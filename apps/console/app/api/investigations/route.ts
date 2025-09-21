import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAudit } from '../../../server/audit';
import { INVESTIGATION_SEVERITIES } from '../../../lib/investigations/constants';
import { getInvestigationById, type InvestigationDetail } from '../../../lib/data/investigations';
import {
  resolveViewer,
  canManageInvestigations,
  canViewInvestigations
} from './utils';

const createSchema = z.object({
  title: z.string().min(1).max(256),
  severity: z.enum(INVESTIGATION_SEVERITIES).default('medium'),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional()
});

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

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.errors[0]?.message ?? 'invalid payload', { status: 400 });
  }

  const data = parsed.data;
  const title = data.title.trim();
  const severity = data.severity;
  const summary = data.summary?.trim() ?? '';
  const tags = normaliseTags(data.tags);

  const { data: inserted, error: insertError } = await (supabase.from('investigations') as any)
    .insert({
      title,
      severity,
      summary: summary || null,
      tags,
      opened_by: staff.user_id
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to create investigation', insertError);
    return new Response('failed to create investigation', { status: 500 });
  }

  const investigationId = (inserted as { id: string }).id;
  let investigation: InvestigationDetail | null = null;

  try {
    investigation = await getInvestigationById(investigationId);
  } catch (lookupError) {
    console.error('Failed to load created investigation', lookupError);
  }

  if (!investigation) {
    return new Response('failed to load created investigation', { status: 500 });
  }

  await logAudit(
    {
      action: 'investigation_create',
      targetType: 'investigation',
      targetId: investigationId,
      resource: 'console.investigations',
      meta: {
        severity,
        tags,
        opened_by: staff.user_id
      }
    },
    request
  );

  return NextResponse.json({ investigation }, { status: 201 });
}
