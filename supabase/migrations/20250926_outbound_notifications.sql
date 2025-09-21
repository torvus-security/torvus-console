-- Outbound notification infrastructure
create table if not exists public.outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('slack','teams')),
  url text not null,
  enabled boolean not null default true,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  event text not null unique,
  enabled boolean not null default true
);

insert into public.notification_prefs (event, enabled)
values
  ('release.approved', true),
  ('release.rejected', true),
  ('investigation.note', true)
on conflict (event) do update set enabled = excluded.enabled;
