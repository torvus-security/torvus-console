create extension if not exists pgcrypto;

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  status text not null default 'open' check (status in ('open','triage','in_progress','closed')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  opened_by uuid not null references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  summary text
);

create table if not exists public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_user_id uuid references public.staff_users(user_id) on delete set null,
  kind text not null check (kind in ('note','status_change','assignment_change','attachment')),
  message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_investigations_updated_at_desc on public.investigations (updated_at desc);
create index if not exists idx_investigation_events_investigation_created_desc on public.investigation_events (investigation_id, created_at desc);

create or replace function public.set_investigations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_investigations_set_updated_at on public.investigations;
create trigger trg_investigations_set_updated_at
before update on public.investigations
for each row
execute function public.set_investigations_updated_at();

create or replace function public.touch_investigation_on_event()
returns trigger
language plpgsql
as $$
begin
  update public.investigations
     set updated_at = now()
   where id = coalesce(new.investigation_id, old.investigation_id);
  return new;
end;
$$;

drop trigger if exists trg_investigation_events_touch on public.investigation_events;
create trigger trg_investigation_events_touch
after insert or update on public.investigation_events
for each row
execute function public.touch_investigation_on_event();

alter table public.investigations enable row level security;
alter table public.investigation_events enable row level security;

drop policy if exists investigations_select_roles on public.investigations;
drop policy if exists investigations_manage_roles on public.investigations;
drop policy if exists investigations_insert_roles on public.investigations;

drop policy if exists investigation_events_select_roles on public.investigation_events;
drop policy if exists investigation_events_insert_roles on public.investigation_events;

create policy investigations_select_roles on public.investigations
for select
to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator','auditor'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

create policy investigations_insert_roles on public.investigations
for insert
to authenticated
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

create policy investigations_manage_roles on public.investigations
for update
to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
)
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

create policy investigation_events_select_roles on public.investigation_events
for select
to authenticated
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator','auditor'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

create policy investigation_events_insert_roles on public.investigation_events
for insert
to authenticated
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.staff_users su
    join public.staff_role_members srm on srm.user_id = su.user_id
    join public.staff_roles sr on sr.id = srm.role_id
    where sr.name = any(array['security_admin','investigator'])
      and (
        (auth.uid() is not null and su.user_id = auth.uid())
        or (public.current_request_email() is not null and su.email = public.current_request_email())
      )
  )
);

create or replace view public.v_investigations_list as
select
  inv.id,
  inv.created_at,
  inv.updated_at,
  inv.title,
  inv.status,
  inv.severity,
  inv.summary,
  inv.tags,
  inv.opened_by,
  opener.email as opened_by_email,
  opener.display_name as opened_by_display_name,
  inv.assigned_to,
  assignee.email as assigned_to_email,
  assignee.display_name as assigned_to_display_name
from public.investigations inv
left join public.staff_users opener on opener.user_id = inv.opened_by
left join public.staff_users assignee on assignee.user_id = inv.assigned_to;

create or replace view public.investigation_events_with_actor as
select
  ev.id,
  ev.investigation_id,
  ev.created_at,
  ev.actor_user_id,
  ev.kind,
  ev.message,
  ev.meta,
  actor.email as actor_email,
  actor.display_name as actor_display_name
from public.investigation_events ev
left join public.staff_users actor on actor.user_id = ev.actor_user_id;

comment on view public.v_investigations_list is 'Investigation list with staff display metadata';
comment on view public.investigation_events_with_actor is 'Investigation events joined with staff display metadata';
