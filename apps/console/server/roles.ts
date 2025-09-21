import { createSupabaseServiceRoleClient } from '../lib/supabase';

function normaliseRoleNames(roleNames: string[]): string[] {
  const normalised = new Set<string>();
  for (const roleName of roleNames) {
    const trimmed = roleName?.trim();
    if (trimmed) {
      normalised.add(trimmed);
    }
  }
  return Array.from(normalised);
}

export async function getRoleIdByName(name: string): Promise<string> {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error('Role name is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('staff_roles') as any)
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve role id for ${trimmed}: ${error.message ?? 'unknown error'}`);
  }

  const row = data as { id: string } | null;
  if (!row?.id) {
    throw new Error(`Role not found: ${trimmed}`);
  }

  return row.id;
}

export async function hasRoleAt(userId: string, roleName: string, at: Date = new Date()): Promise<boolean> {
  if (!userId?.trim()) {
    throw new Error('User id is required');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('staff_role_members') as any)
    .select('valid_from, valid_to, staff_roles!inner(name)')
    .eq('user_id', userId)
    .eq('staff_roles.name', roleName)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking role membership: ${error.message ?? 'unknown error'}`);
  }

  const membership = data as { valid_from: string | null; valid_to: string | null } | null;
  if (!membership) {
    return false;
  }

  const atTime = at instanceof Date ? at : new Date(at);
  const validFrom = membership.valid_from ? new Date(membership.valid_from) : null;
  if (validFrom && validFrom > atTime) {
    return false;
  }

  if (!membership.valid_to) {
    return true;
  }

  const validTo = new Date(membership.valid_to);
  return validTo > atTime;
}

export async function grantTemporaryRoles(params: {
  targetUserId: string;
  roleNames: string[];
  minutes: number;
  justification?: string;
  ticketUrl?: string;
}): Promise<void> {
  const { targetUserId, roleNames, minutes, justification, ticketUrl } = params;
  if (!targetUserId?.trim()) {
    throw new Error('Target user id is required');
  }
  if (!Array.isArray(roleNames) || roleNames.length === 0) {
    throw new Error('At least one role is required');
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('Minutes must be a positive number');
  }

  const supabase = createSupabaseServiceRoleClient<any>();
  const names = normaliseRoleNames(roleNames);
  if (names.length === 0) {
    throw new Error('Role names were empty after normalisation');
  }

  const { data: roleRows, error: roleError } = await (supabase.from('staff_roles') as any)
    .select('id, name')
    .in('name', names);

  if (roleError) {
    throw new Error(`Failed to load role identifiers: ${roleError.message ?? 'unknown error'}`);
  }

  const roleMap = new Map<string, string>();
  for (const row of (roleRows as Array<{ id: string; name: string }> | null) ?? []) {
    roleMap.set(row.name, row.id);
  }

  const missingRoles = names.filter((role) => !roleMap.has(role));
  if (missingRoles.length > 0) {
    throw new Error(`Unknown roles: ${missingRoles.join(', ')}`);
  }

  const now = new Date();
  const newExpiry = new Date(now.getTime() + minutes * 60_000);
  const newExpiryIso = newExpiry.toISOString();

  for (const roleName of names) {
    const roleId = roleMap.get(roleName)!;
    const { data: existingRow, error: existingError } = await (supabase
      .from('staff_role_members') as any)
      .select('valid_to, granted_via')
      .eq('user_id', targetUserId)
      .eq('role_id', roleId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to inspect existing membership: ${existingError.message ?? 'unknown error'}`);
    }

    const existing = existingRow as { valid_to: string | null; granted_via: string | null } | null;

    if (!existing) {
      const insertPayload: Record<string, unknown> = {
        user_id: targetUserId,
        role_id: roleId,
        granted_via: 'break_glass',
        valid_from: now.toISOString(),
        valid_to: newExpiryIso,
        justification: justification ?? null,
        ticket_url: ticketUrl ?? null
      };

      const { error: insertError } = await (supabase.from('staff_role_members') as any).insert(insertPayload);
      if (insertError) {
        throw new Error(`Failed to grant temporary role ${roleName}: ${insertError.message ?? 'unknown error'}`);
      }
      continue;
    }

    if (existing.granted_via !== 'break_glass') {
      continue;
    }

    let nextValidToIso = newExpiryIso;
    if (existing.valid_to) {
      const currentExpiry = new Date(existing.valid_to);
      if (currentExpiry > newExpiry) {
        nextValidToIso = currentExpiry.toISOString();
      }
    }

    const updatePayload: Record<string, unknown> = {
      granted_via: 'break_glass',
      valid_to: nextValidToIso
    };

    if (justification !== undefined) {
      updatePayload.justification = justification;
    }
    if (ticketUrl !== undefined) {
      updatePayload.ticket_url = ticketUrl;
    }

    const { error: updateError } = await (supabase
      .from('staff_role_members') as any)
      .update(updatePayload)
      .eq('user_id', targetUserId)
      .eq('role_id', roleId);

    if (updateError) {
      throw new Error(`Failed to extend temporary role ${roleName}: ${updateError.message ?? 'unknown error'}`);
    }
  }
}
