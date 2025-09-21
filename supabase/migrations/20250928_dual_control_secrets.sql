-- Dual-control secrets infrastructure (Feature 15)
create table if not exists public.secrets (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  env text not null default 'prod',
  description text null,
  ciphertext bytea not null,
  iv bytea not null,
  aad text null,
  version int not null default 1,
  requires_dual_control boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_rotated_at timestamptz null,
  last_accessed_at timestamptz null,
  unique (key, env)
);

create index if not exists secrets_key_env_idx on public.secrets (key, env);

create table if not exists public.secret_change_requests (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  env text not null default 'prod',
  action text not null check (action in ('create','rotate','reveal')),
  proposed_ciphertext bytea null,
  proposed_iv bytea null,
  proposed_aad text null,
  reason text not null,
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied','expired')),
  created_at timestamptz not null default now(),
  applied_at timestamptz null
);

create index if not exists secret_change_requests_status_created_at_idx
  on public.secret_change_requests (status, created_at desc);

create table if not exists public.secret_change_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.secret_change_requests(id) on delete cascade,
  approver_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (request_id, approver_user_id)
);

create index if not exists secret_change_approvals_request_idx
  on public.secret_change_approvals (request_id);

alter table if exists public.outbound_webhooks
  add column if not exists secret_key text null;

create index if not exists outbound_webhooks_secret_key_idx
  on public.outbound_webhooks (secret_key)
  where secret_key is not null;
