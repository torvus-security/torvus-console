-- Torvus Security — Enable RLS + Policies (public schema)
-- Date: 2025-09-21

-- Helper: speed up EXISTS-based predicates
create index if not exists idx_vaults_owner_uid on public.vaults(owner_uid);
create index if not exists idx_recipients_vault_id on public.recipients(vault_id);
create index if not exists idx_policies_vault_id on public.policies(vault_id);
create index if not exists idx_checkins_vault_id on public.checkins(vault_id);
create index if not exists idx_documents_vault_id on public.documents(vault_id);
create index if not exists idx_release_batches_vault_id on public.release_batches(vault_id);
create index if not exists idx_release_items_batch_id on public.release_items(batch_id);
create index if not exists idx_document_scans_document_id on public.document_scans(document_id);

-- === VAULTS (owner-scoped CRUD) ===
alter table public.vaults enable row level security;
drop policy if exists v_select_own on public.vaults;
drop policy if exists v_insert_own on public.vaults;
drop policy if exists v_update_own on public.vaults;
drop policy if exists v_delete_own on public.vaults;

create policy v_select_own
  on public.vaults for select
  to authenticated
  using (owner_uid = auth.uid());

create policy v_insert_own
  on public.vaults for insert
  to authenticated
  with check (owner_uid = auth.uid());

create policy v_update_own
  on public.vaults for update
  to authenticated
  using (owner_uid = auth.uid())
  with check (owner_uid = auth.uid());

create policy v_delete_own
  on public.vaults for delete
  to authenticated
  using (owner_uid = auth.uid());

-- === RECIPIENTS (owner-scoped via vault) ===
alter table public.recipients enable row level security;
drop policy if exists r_select_owner_vault on public.recipients;
drop policy if exists r_insert_owner_vault on public.recipients;
drop policy if exists r_update_owner_vault on public.recipients;
drop policy if exists r_delete_owner_vault on public.recipients;

create policy r_select_owner_vault
  on public.recipients for select
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = auth.uid()
  ));

create policy r_insert_owner_vault
  on public.recipients for insert
  to authenticated
  with check (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = auth.uid()
  ));

create policy r_update_owner_vault
  on public.recipients for update
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = auth.uid()
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = auth.uid()
  ));

create policy r_delete_owner_vault
  on public.recipients for delete
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = recipients.vault_id and v.owner_uid = auth.uid()
  ));

-- === POLICIES (owner-scoped via vault) ===
alter table public.policies enable row level security;
drop policy if exists p_select_owner_vault on public.policies;
drop policy if exists p_upsert_owner_vault on public.policies;
drop policy if exists p_delete_owner_vault on public.policies;

create policy p_select_owner_vault
  on public.policies for select
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = auth.uid()
  ));

create policy p_upsert_owner_vault
  on public.policies for all
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = auth.uid()
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = auth.uid()
  ));

create policy p_delete_owner_vault
  on public.policies for delete
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = policies.vault_id and v.owner_uid = auth.uid()
  ));

-- === CHECKINS (owner view; owner inserts for their vaults) ===
alter table public.checkins enable row level security;
drop policy if exists c_select_owner_vault on public.checkins;
drop policy if exists c_insert_owner_vault on public.checkins;

create policy c_select_owner_vault
  on public.checkins for select
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = checkins.vault_id and v.owner_uid = auth.uid()
  ));

create policy c_insert_owner_vault
  on public.checkins for insert
  to authenticated
  with check (
    actor_uid = auth.uid() and
    exists (select 1 from public.vaults v
            where v.id = checkins.vault_id and v.owner_uid = auth.uid())
  );

-- === DOCUMENTS (owner-scoped via vault) ===
alter table public.documents enable row level security;
drop policy if exists d_select_owner_vault on public.documents;
drop policy if exists d_insert_owner_vault on public.documents;
drop policy if exists d_update_owner_vault on public.documents;
drop policy if exists d_delete_owner_vault on public.documents;

create policy d_select_owner_vault
  on public.documents for select
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = auth.uid()
  ));

create policy d_insert_owner_vault
  on public.documents for insert
  to authenticated
  with check (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = auth.uid()
  ));

create policy d_update_owner_vault
  on public.documents for update
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = auth.uid()
  ))
  with check (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = auth.uid()
  ));

create policy d_delete_owner_vault
  on public.documents for delete
  to authenticated
  using (exists (
    select 1 from public.vaults v
    where v.id = documents.vault_id and v.owner_uid = auth.uid()
  ));

-- === SYSTEM / EXECUTOR TABLES (no client access) ===

-- document_scans
alter table public.document_scans enable row level security;
drop policy if exists ds_deny_all on public.document_scans;
create policy ds_deny_all on public.document_scans for all to authenticated using (false) with check (false);

-- release_decisions (option: owners may read history; here we keep service-only)
alter table public.release_decisions enable row level security;
drop policy if exists rd_deny_all on public.release_decisions;
create policy rd_deny_all on public.release_decisions for all to authenticated using (false) with check (false);

-- release_batches
alter table public.release_batches enable row level security;
drop policy if exists rb_deny_all on public.release_batches;
create policy rb_deny_all on public.release_batches for all to authenticated using (false) with check (false);

-- release_items
alter table public.release_items enable row level security;
drop policy if exists ri_deny_all on public.release_items;
create policy ri_deny_all on public.release_items for all to authenticated using (false) with check (false);

-- audit_events (admin UI uses service role)
alter table public.audit_events enable row level security;
drop policy if exists ae_deny_all on public.audit_events;
create policy ae_deny_all on public.audit_events for all to authenticated using (false) with check (false);

-- preview_tokens (never expose)
alter table public.preview_tokens enable row level security;
drop policy if exists pt_deny_all on public.preview_tokens;
create policy pt_deny_all on public.preview_tokens for all to authenticated using (false) with check (false);

-- recipient_verify_tokens (never expose)
alter table public.recipient_verify_tokens enable row level security;
drop policy if exists rvt_deny_all on public.recipient_verify_tokens;
create policy rvt_deny_all on public.recipient_verify_tokens for all to authenticated using (false) with check (false);

-- email_events (internal telemetry)
alter table public.email_events enable row level security;
drop policy if exists ee_deny_all on public.email_events;
create policy ee_deny_all on public.email_events for all to authenticated using (false) with check (false);

-- Optional belt-and-braces: revoke legacy grants (RLS still governs row access)
revoke all on public.vaults, public.recipients, public.policies, public.checkins, public.documents,
  public.document_scans, public.release_decisions, public.release_batches, public.release_items,
  public.audit_events, public.preview_tokens, public.recipient_verify_tokens, public.email_events
from anon, authenticated;