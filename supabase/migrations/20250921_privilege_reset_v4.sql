-- Pin search_path for selected public functions (safe + idempotent)
-- We set to pg_catalog first (builtins), then the schema that holds our objects.
-- If any function references other schemas, make sure those references are schema-qualified.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_admin','set_user_id_default','handle_new_user')
  loop
    execute format('alter function %s set search_path = pg_catalog, public', r.sig);
  end loop;
end$$;

-- Optional: pin ALL public functions (uncomment if you want to enforce repo-wide)
-- do $$
-- declare r record;
-- begin
--   for r in
--     select p.oid::regprocedure as sig
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--   loop
--     execute format('alter function %s set search_path = pg_catalog, public', r.sig);
--   end loop;
-- end$$;