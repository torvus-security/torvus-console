create table if not exists public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(user_id) on delete cascade,
  name text not null,
  token_hash bytea not null,
  scopes text[] not null default '{read,write}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  expires_at timestamptz null,
  revoked boolean not null default false,
  constraint personal_access_tokens_user_id_name_key unique (user_id, name)
);

create index if not exists personal_access_tokens_user_id_idx
  on public.personal_access_tokens (user_id);

create index if not exists personal_access_tokens_revoked_expires_at_idx
  on public.personal_access_tokens (revoked, expires_at);

create index if not exists personal_access_tokens_last_used_at_idx
  on public.personal_access_tokens (last_used_at);
