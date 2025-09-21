import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';
import {
  getRequesterEmail,
  getStaffUserByEmail,
  getUserRolesByEmail,
  type StaffUserRecord
} from '../../../lib/auth';

export type ViewerOk = {
  type: 'ok';
  supabase: SupabaseClient<any>;
  email: string;
  roles: string[];
  staff: StaffUserRecord | null;
};

export type ViewerError = {
  type: 'error';
  response: Response;
};

export type ViewerResolution = ViewerOk | ViewerError;

const VIEW_ROLES = new Set(['security_admin', 'investigator', 'auditor']);
const MANAGE_ROLES = new Set(['security_admin', 'investigator']);

export async function resolveViewer(request: Request): Promise<ViewerResolution> {
  const email = getRequesterEmail(request);
  if (!email) {
    return { type: 'error', response: new Response('unauthorized', { status: 401 }) };
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const [roles, staff] = await Promise.all([
      getUserRolesByEmail(email, supabase),
      getStaffUserByEmail(email, supabase)
    ]);

    return { type: 'ok', supabase, email, roles, staff } satisfies ViewerOk;
  } catch (error) {
    console.error('Failed to resolve viewer context', error);
    return { type: 'error', response: new Response('failed to resolve viewer', { status: 500 }) };
  }
}

export function canViewInvestigations(roles: string[]): boolean {
  return roles.some((role) => VIEW_ROLES.has(role.toLowerCase()));
}

export function canManageInvestigations(roles: string[]): boolean {
  return roles.some((role) => MANAGE_ROLES.has(role.toLowerCase()));
}

export async function loadStaffSummaries(
  supabase: SupabaseClient<any>,
  userIds: Array<string | null | undefined>
): Promise<Map<string, { display_name: string | null; email: string | null }>> {
  const filtered = Array.from(
    new Set(
      userIds
        .map((id) => id?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const summary = new Map<string, { display_name: string | null; email: string | null }>();

  if (!filtered.length) {
    return summary;
  }

  const { data, error } = await (supabase.from('staff_users') as any)
    .select('user_id, display_name, email')
    .in('user_id', filtered);

  if (error) {
    throw error;
  }

  for (const row of (data as Array<{ user_id: string; display_name: string | null; email: string | null }> | null) ?? []) {
    summary.set(row.user_id, { display_name: row.display_name, email: row.email });
  }

  return summary;
}
