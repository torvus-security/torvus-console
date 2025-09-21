import { NextResponse } from 'next/server';
import {
  hasSecurityAdminRole,
  loadStaffSummaries,
  resolveViewer,
  type ReleaseRequestViewRow,
  type StaffSummary
} from './utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const viewer = await resolveViewer(request);
  if (viewer.type === 'error') {
    return viewer.response;
  }

  const { supabase, roles, staff } = viewer;

  if (!staff) {
    return new Response('forbidden', { status: 403 });
  }

  const isSecurityAdmin = hasSecurityAdminRole(roles);

  const { data, error } = await (supabase.from('release_requests_with_counts') as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to load release requests', error);
    return new Response('failed to load release requests', { status: 500 });
  }

  const rows = (data as ReleaseRequestViewRow[] | null) ?? [];
  const filteredRows = isSecurityAdmin ? rows : rows.filter((row) => row.requested_by === staff.user_id);

  let staffSummaries: Map<string, StaffSummary>;
  try {
    staffSummaries = await loadStaffSummaries(
      supabase,
      filteredRows.map((row) => row.requested_by)
    );
  } catch (summaryError) {
    console.error('Failed to load requester summaries', summaryError);
    return new Response('failed to load release requests', { status: 500 });
  }

  const requests = filteredRows.map((row) => ({
    ...row,
    approve_count: Number(row.approve_count ?? 0),
    reject_count: Number(row.reject_count ?? 0),
    requested_by_user: staffSummaries.get(row.requested_by) ?? null
  }));

  return NextResponse.json({
    viewer: {
      email: viewer.email,
      roles,
      user_id: staff.user_id,
      display_name: staff.display_name
    },
    requests
  });
}

export async function POST(request: Request) {
  const viewer = await resolveViewer(request);
  if (viewer.type === 'error') {
    return viewer.response;
  }

  const { supabase, staff, roles } = viewer;

  if (!staff) {
    return new Response('forbidden', { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const payload = body as { title?: unknown; description?: unknown };
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : undefined;

  if (!title) {
    return new Response('title is required', { status: 400 });
  }

  const insertPayload = {
    title,
    description: description ? description : null,
    requested_by: staff.user_id
  };

  const { data: insertedRows, error: insertError } = await (supabase.from('release_requests') as any)
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    console.error('Failed to create release request', insertError);
    return new Response('failed to create release request', { status: 500 });
  }

  const inserted = insertedRows as ReleaseRequestViewRow;

  const { data: viewRows, error: viewError } = await (supabase.from('release_requests_with_counts') as any)
    .select('*')
    .eq('id', inserted.id)
    .maybeSingle();

  if (viewError) {
    console.error('Failed to load created release request', viewError);
    return new Response('failed to load created release request', { status: 500 });
  }

  const viewRow = (viewRows as ReleaseRequestViewRow | null) ?? null;

  if (!viewRow) {
    return new Response('created release request missing', { status: 500 });
  }

  let staffSummary: Map<string, StaffSummary>;
  try {
    staffSummary = await loadStaffSummaries(supabase, [viewRow.requested_by]);
  } catch (summaryError) {
    console.error('Failed to load requester summary', summaryError);
    return new Response('failed to load created release request', { status: 500 });
  }

  const responseBody = {
    viewer: {
      email: viewer.email,
      roles,
      user_id: staff.user_id,
      display_name: staff.display_name
    },
    request: {
      ...viewRow,
      approve_count: Number(viewRow.approve_count ?? 0),
      reject_count: Number(viewRow.reject_count ?? 0),
      requested_by_user: staffSummary.get(viewRow.requested_by) ?? null
    }
  };

  return NextResponse.json(responseBody, { status: 201 });
}
