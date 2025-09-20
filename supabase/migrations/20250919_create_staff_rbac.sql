-- Torvus Console RBAC + Dual-Control (Postgres / Supabase)
-- idempotent-ish: drop statements guarded; enable extensions where needed.

-- Ensure pgcrypto for gen_random_uuid (Supabase has it)
create extension if not exists pgcrypto;

-- Roles
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default '',
  created_at timestamptz not null default now()
);

-- Staff users (link to auth.users)
create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  passkey_enrolled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Memberships
create table if not exists public.staff_role_members (
  user_id uuid not null references public.staff_users(user_id) on delete cascade,
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Permission catalog
create table if not exists public.staff_permissions (
  key text primary key,
  description text not null
);

-- Role → Permission mapping
create table if not exists public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission_key text not null references public.staff_permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- Dual-control request registry
create type if not exists dual_control_status as enum ('requested','approved','executed','rejected','expired');

create table if not exists public.staff_dual_control_requests (
  id uuid primary key default gen_random_uuid(),
  action_key text not null,                               -- e.g., 'releases.execute'
  payload jsonb not null,                                 -- opaque to UI; server validates on execute
  correlation_id text not null,                           -- tie to audit trail
  requested_by uuid not null references public.staff_users(user_id) on delete cascade,
  approved_by uuid references public.staff_users(user_id) on delete set null,
  status dual_control_status not null default 'requested',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  unique (action_key, correlation_id)                     -- idempotency on action/target
);

-- Indexes
create index if not exists idx_staff_role_members_user on public.staff_role_members(user_id);
create index if not exists idx_staff_role_members_role on public.staff_role_members(role_id);
create index if not exists idx_dual_control_status on public.staff_dual_control_requests(status);

-- Seed roles
insert into public.staff_roles (name, description) values
  ('viewer','Read-only metrics and logs'),
  ('auditor','Export evidence and logs'),
  ('operator','Run simulators; request sensitive ops'),
  ('security_admin','Manage staff & roles; approve sensitive ops'),
  ('break_glass','Emergency elevated role (dual-control enforced)')
on conflict (name) do nothing;

-- Seed permissions
insert into public.staff_permissions (key, description) values
  ('metrics.view','View overview metrics'),
  ('audit.read','View audit events'),
  ('audit.export','Export audit evidence'),
  ('releases.simulate','Simulate releases'),
  ('releases.execute','Execute releases (dual-control)'),
  ('policy.edit','Edit sensitive policies'),
  ('staff.manage','Manage staff users and roles')
on conflict (key) do nothing;

-- Map role → permissions (minimal starter matrix)
-- viewer
insert into public.staff_role_permissions select r.id, p.key
from public.staff_roles r, public.staff_permissions p
where r.name='viewer' and p.key in ('metrics.view','audit.read')
on conflict do nothing;

-- auditor
insert into public.staff_role_permissions select r.id, p.key
from public.staff_roles r, public.staff_permissions p
where r.name='auditor' and p.key in ('metrics.view','audit.read','audit.export')
on conflict do nothing;

-- operator
insert into public.staff_role_permissions select r.id, p.key
from public.staff_roles r, public.staff_permissions p
where r.name='operator' and p.key in ('metrics.view','audit.read','releases.simulate')
on conflict do nothing;

-- security_admin
insert into public.staff_role_permissions select r.id, p.key
from public.staff_roles r, public.staff_permissions p
where r.name='security_admin'
on conflict do nothing;

-- break_glass
insert into public.staff_role_permissions select r.id, p.key
from public.staff_roles r, public.staff_permissions p
where r.name='break_glass' and p.key in ('metrics.view','audit.read','audit.export','releases.simulate','releases.execute','policy.edit','staff.manage')
on conflict do nothing;

-- RLS: keep ON; allow only service role by default (application enforces fine-grained checks)
alter table public.staff_roles enable row level security;
alter table public.staff_users enable row level security;
alter table public.staff_role_members enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_dual_control_requests enable row level security;

create policy service_role_all on public.staff_roles for all using (auth.role() = 'service_role');
create policy service_role_all2 on public.staff_users for all using (auth.role() = 'service_role');
create policy service_role_all3 on public.staff_role_members for all using (auth.role() = 'service_role');
create policy service_role_all4 on public.staff_permissions for all using (auth.role() = 'service_role');
create policy service_role_all5 on public.staff_role_permissions for all using (auth.role() = 'service_role');
create policy service_role_all6 on public.staff_dual_control_requests for all using (auth.role() = 'service_role');
