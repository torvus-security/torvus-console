-- Torvus Security — RLS perf fixes + index cleanup (2025-09-21)

begin;

-- 0) Duplicate index cleanup (keep idx_release_items_batch_id)
drop index if exists public.release_items_batch_idx;

-- 1) Core app tables — drop & recreate policies with (select auth.uid())
-- === VAULTS ===
alter table public.vaults enable row level security; alter table public.vaults force row level security;
drop policy if exists v_select_own on public.vaults;
drop policy if exists v_insert_own on public.vaults;
drop policy if exists v_update_own on public.vaults;
drop policy if exists v_delete_own on public.vaults;

create policy v_select_own
  on public.vaults for select to authenticated
  using (owner_uid = (select auth.uid()));

create policy v_insert_own
  on public.vaults for insert to authenticated
  with check (owner_uid = (select auth.uid()));

create policy v_update_own
  on public.vaults for update to authenticated
  using (owner_uid = (select auth.uid()))
  with check (owner_uid = (select auth.uid()));

create policy v_delete_own
  on public.vaults for delete to authenticated
  using (owner_uid = (select auth.uid()));

-- === RECIPIENTS ===
alter table public.recipients enable row level security; alter table public.recipients force row level security;
drop policy if exists r_select_owner_vault on public.recipients;
drop policy if exists r_insert_owner_vault on public.recipients;
drop policy if exists r_update_owner_vault on public.recipients;
drop policy if exists r_delete_owner_vault on public.recipients;

create policy r_select_owner_vault
  on public.recipients for select to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy r_insert_owner_vault
  on public.recipients for insert to authenticated
  with check (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy r_update_owner_vault
  on public.recipients for update to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy r_delete_owner_vault
  on public.recipients for delete to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = (select auth.uid())
  ));

-- === POLICIES (app table) ===
alter table public.policies enable row level security; alter table public.policies force row level security;
drop policy if exists p_select_owner_vault on public.policies;
drop policy if exists p_upsert_owner_vault on public.policies;
drop policy if exists p_delete_owner_vault on public.policies;

create policy p_select_owner_vault
  on public.policies for select to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = (select auth.uid())
  ));

-- IMPORTANT: scope upsert to INSERT, UPDATE (was ALL) to remove duplicate-permissive warning
create policy p_upsert_owner_vault
  on public.policies for insert to authenticated
  with check (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy p_update_owner_vault
  on public.policies for update to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy p_delete_owner_vault
  on public.policies for delete to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = (select auth.uid())
  ));

-- === CHECKINS ===
alter table public.checkins enable row level security; alter table public.checkins force row level security;
drop policy if exists c_select_owner_vault on public.checkins;
drop policy if exists c_insert_owner_vault on public.checkins;

create policy c_select_owner_vault
  on public.checkins for select to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = checkins.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy c_insert_owner_vault
  on public.checkins for insert to authenticated
  with check (
    actor_uid = (select auth.uid()) and
    exists (select 1 from public.vaults v
            where v.id = checkins.vault_id and v.owner_uid = (select auth.uid()))
  );

-- === DOCUMENTS ===
alter table public.documents enable row level security; alter table public.documents force row level security;
drop policy if exists d_select_owner_vault on public.documents;
drop policy if exists d_insert_owner_vault on public.documents;
drop policy if exists d_update_owner_vault on public.documents;
drop policy if exists d_delete_owner_vault on public.documents;

create policy d_select_owner_vault
  on public.documents for select to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy d_insert_owner_vault
  on public.documents for insert to authenticated
  with check (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy d_update_owner_vault
  on public.documents for update to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = (select auth.uid())
  ));

create policy d_delete_owner_vault
  on public.documents for delete to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = (select auth.uid())
  ));

-- 2) Profiles (keep minimal self-access; switch to subselect form)
alter table public.profiles enable row level security; alter table public.profiles force row level security;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

-- NOTE: Assumes the conventional Supabase schema where profiles.id = auth.uid()
create policy profiles_self_read
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_self_update
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 3) Legacy / staff / service-only tables:
--    Remove any old owner/service_role policies that reference auth.* and replace with one deny-all.
do $$
declare t text;
declare p record;
begin
  for t in
    select tablename from pg_tables
    where schemaname='public'
      and tablename in (
        'assets','audits','audit_logs',
        'release_bundles',
        'feature_entitlements','key_shares',
        'death_verifications','estate_cases',
        'legacy_agent_kyc_docs','legacy_agents',
        'staff_users','staff_roles','staff_role_members','staff_role_permissions','staff_permissions','staff_dual_control_requests'
      )
  loop
    -- drop every existing policy on the table (then recreate single deny-all)
    for p in
      select policyname from pg_policies
      where schemaname='public' and tablename=t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (false) with check (false)', 'deny_all_'||t, t);
  end loop;
end$$;

commit;