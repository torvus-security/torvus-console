create extension if not exists pgcrypto;

create table if not exists public.inbound_integrations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('generic','statuspage','sentry','posthog')),
  name text not null,
  secret_hash bytea not null,
  secret_ciphertext bytea not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  unique (kind, name)
);

create table if not exists public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.inbound_integrations(id) on delete cascade,
  ext_id text not null,
  dedup_hash bytea not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  unique (integration_id, ext_id)
);

create index if not exists idx_inbound_events_integration_received_desc
  on public.inbound_events (integration_id, received_at desc);

create index if not exists idx_inbound_events_dedup_hash
  on public.inbound_events (dedup_hash);

alter table public.inbound_integrations enable row level security;
alter table public.inbound_events enable row level security;

create policy inbound_integrations_service_role on public.inbound_integrations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy inbound_events_service_role on public.inbound_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
