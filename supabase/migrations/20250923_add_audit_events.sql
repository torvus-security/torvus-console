create extension if not exists pgcrypto;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  happened_at timestamptz not null default now(),
  actor_user_id uuid null,
  actor_email text null,
  actor_roles text[] null,
  action text not null,
  target_type text null,
  target_id text null,
  resource text null,
  ip inet null,
  user_agent text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_events_happened_at_desc on public.audit_events (happened_at desc);
create index if not exists idx_audit_events_action on public.audit_events (action);
create index if not exists idx_audit_events_actor_email on public.audit_events (actor_email);
create index if not exists idx_audit_events_target on public.audit_events (target_type, target_id);

alter table public.audit_events enable row level security;

create or replace function public.current_request_email()
returns text
language sql
stable
as $$
  select lower(nullif(current_setting('request.jwt.claim.email', true), ''));
$$;

drop policy if exists audit_events_read_policy on public.audit_events;
create policy audit_events_read_policy on public.audit_events
for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','auditor'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

drop function if exists public.log_audit_event(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  text,
  inet,
  text,
  jsonb
);
create or replace function public.log_audit_event(
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_roles text[],
  p_action text,
  p_target_type text,
  p_target_id text,
  p_resource text,
  p_ip inet,
  p_user_agent text,
  p_meta jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events (
    actor_user_id,
    actor_email,
    actor_roles,
    action,
    target_type,
    target_id,
    resource,
    ip,
    user_agent,
    meta
  ) values (
    p_actor_user_id,
    nullif(trim(lower(p_actor_email)), ''),
    case when array_length(p_actor_roles, 1) is null then null else p_actor_roles end,
    trim(p_action),
    nullif(trim(p_target_type), ''),
    nullif(trim(p_target_id), ''),
    nullif(trim(p_resource), ''),
    p_ip,
    nullif(trim(p_user_agent), ''),
    coalesce(p_meta, '{}'::jsonb)
  );
$$;

grant execute on function public.log_audit_event(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  text,
  inet,
  text,
  jsonb
) to anon, authenticated, service_role;
