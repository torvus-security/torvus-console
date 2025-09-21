import { headers as nextHeaders } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '../lib/supabase';
import {
  getRequesterEmail,
  getSessionUser,
  getStaffUserByEmail,
  getUserRolesByEmail,
  type StaffUserRecord
} from '../lib/auth';

export type AuditLogInput = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  resource?: string | null;
  meta?: Record<string, unknown> | undefined;
};

export type RequestLike = Pick<Request, 'headers'> | { headers: Headers } | NextRequest | Request;

type ActorContext = {
  userId: string | null;
  email: string | null;
  roles: string[];
  displayName: string | null;
};

function resolveHeaders(requestLike?: RequestLike): Headers {
  if (requestLike) {
    if ('headers' in requestLike) {
      return requestLike.headers instanceof Headers ? requestLike.headers : new Headers(requestLike.headers);
    }
  }

  try {
    return nextHeaders();
  } catch {
    return new Headers();
  }
}

function parseForwardedFor(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parts = value.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function extractIp(headers: Headers): string | null {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-client-ip'),
    parseForwardedFor(headers.get('x-forwarded-for')),
    headers.get('x-real-ip')
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const forwarded = headers.get('forwarded');
  if (forwarded) {
    const match = forwarded.match(/for=([^;]+)/i);
    if (match && match[1]) {
      const value = match[1].replace(/^"|"$/g, '').trim();
      if (value) {
        return value;
      }
    }
  }

  return null;
}

async function resolveActor(
  headers: Headers,
  supabase = createSupabaseServiceRoleClient<any>()
): Promise<ActorContext> {
  let sessionUser: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    sessionUser = await getSessionUser();
  } catch (error) {
    console.warn('[audit] failed to resolve session user', error);
  }

  let actorEmail = sessionUser?.email ?? null;
  let actorUserId = sessionUser?.id ?? null;
  let staffRecord: StaffUserRecord | null = null;

  if (!actorEmail) {
    try {
      const request = new Request('https://internal.local/audit', { headers });
      actorEmail = getRequesterEmail(request);
    } catch (error) {
      console.warn('[audit] failed to resolve requester email', error);
    }
  }

  if (actorEmail) {
    try {
      staffRecord = await getStaffUserByEmail(actorEmail, supabase);
      if (staffRecord) {
        actorUserId = staffRecord.user_id;
        actorEmail = staffRecord.email;
      }
    } catch (error) {
      console.warn('[audit] failed to resolve staff user by email', error);
    }
  }

  if (!staffRecord && actorUserId) {
    try {
      const { data, error } = await (supabase.from('staff_users') as any)
        .select('user_id, email, display_name')
        .eq('user_id', actorUserId)
        .maybeSingle();

      if (!error && data) {
        staffRecord = {
          user_id: data.user_id,
          email: data.email,
          display_name: data.display_name
        };
        actorEmail = staffRecord.email;
      }
    } catch (error) {
      console.warn('[audit] failed to load staff record by id', error);
    }
  }

  let roles: string[] = [];
  if (actorEmail) {
    try {
      roles = await getUserRolesByEmail(actorEmail, supabase);
    } catch (error) {
      console.warn('[audit] failed to resolve actor roles', error);
    }
  }

  return {
    userId: staffRecord?.user_id ?? actorUserId ?? null,
    email: staffRecord?.email ?? actorEmail ?? null,
    roles,
    displayName: staffRecord?.display_name ?? null
  };
}

function normaliseMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(meta));
  } catch (error) {
    console.warn('[audit] failed to serialise meta payload', error);
    return {};
  }
}

export async function logAudit(details: AuditLogInput, requestLike?: RequestLike): Promise<void> {
  if (!details.action || !details.action.trim()) {
    console.warn('[audit] skipped logging due to missing action');
    return;
  }

  const headers = resolveHeaders(requestLike);
  const supabase = createSupabaseServiceRoleClient<any>();
  const actor = await resolveActor(headers, supabase);

  const ip = extractIp(headers);
  const userAgent = headers.get('user-agent');

  try {
    const { error } = await (supabase.rpc('log_audit_event', {
      p_actor_user_id: actor.userId,
      p_actor_email: actor.email,
      p_actor_roles: actor.roles.length > 0 ? actor.roles : null,
      p_action: details.action,
      p_target_type: details.targetType ?? null,
      p_target_id: details.targetId ?? null,
      p_resource: details.resource ?? null,
      p_ip: ip ?? null,
      p_user_agent: userAgent ?? null,
      p_meta: normaliseMeta(details.meta)
    }) as any);

    if (error) {
      console.warn('[audit] log_audit_event RPC failed', error);
    }
  } catch (error) {
    console.error('[audit] unexpected error invoking log_audit_event', error);
  }
}

export async function withAudit<T>(
  details: AuditLogInput,
  operation: () => Promise<T>,
  requestLike?: RequestLike
): Promise<T> {
  const result = await operation();
  try {
    await logAudit(details, requestLike);
  } catch (error) {
    console.error('[audit] failed to log audit event after operation', error);
  }
  return result;
}
