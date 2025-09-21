-- Torvus Security — Public schema privilege hardening (2025-09-21)

-- 1) Remove ALL rights from anon on every table in public
revoke all on all tables in schema public from anon;

-- 2) Strip dangerous powers from authenticated everywhere, we’ll re-grant least-privilege per table
revoke trigger, truncate, references on all tables in schema public from authenticated;

-- 3) (Re)grant only what the app needs on end-user tables (RLS will still govern row access)
grant select, insert, update, delete on
  public.vaults,
  public.recipients,
  public.policies,
  public.checkins,
  public.documents
to authenticated;

-- Profiles are editable by the logged-in user; keep this minimal
grant select, update on public.profiles to authenticated;

-- Ensure anon truly has no direct access on app tables
revoke all on
  public.vaults,
  public.recipients,
  public.policies,
  public.checkins,
  public.documents,
  public.profiles
from anon;

-- 4) Belt-and-braces: enable + force RLS on every table in public (harmless if already set)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
    execute format('alter table %I.%I force row level security',  r.schemaname, r.tablename);
  end loop;
end$$;