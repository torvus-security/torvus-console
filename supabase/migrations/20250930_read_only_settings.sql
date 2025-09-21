-- Read-only mode app settings
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

insert into public.app_settings (key, value)
select 'read_only', jsonb_build_object(
  'enabled', false,
  'message', 'Maintenance in progress',
  'allow_roles', jsonb_build_array('security_admin')
)
where not exists (
  select 1 from public.app_settings where key = 'read_only'
);
