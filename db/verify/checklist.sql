-- Verify that all database structures referenced by the console exist.
-- This script only returns rows when something is missing.

with required_tables(schema_name, table_name) as (
  values
    ('public','staff_users'),
    ('public','staff_roles'),
    ('public','staff_role_members'),
    ('public','staff_role_permissions'),
    ('public','staff_permissions'),
    ('public','staff_dual_control_requests'),
    ('public','personal_access_tokens'),
    ('public','audit_events'),
    ('public','inbound_integrations'),
    ('public','inbound_events'),
    ('public','investigations'),
    ('public','investigation_events'),
    ('public','release_requests'),
    ('public','release_approvals'),
    ('public','notification_prefs'),
    ('public','outbound_webhooks'),
    ('public','secrets'),
    ('public','secret_change_requests'),
    ('public','secret_change_approvals'),
    ('public','app_settings'),
    ('public','elevation_requests'),
    ('public','elevation_approvals'),
    ('public','alerts'),
    ('public','app_control')
),
required_columns(schema_name, table_name, column_name) as (
  values
    ('public','staff_users','user_id'),
    ('public','staff_users','email'),
    ('public','staff_users','display_name'),
    ('public','staff_users','passkey_enrolled'),
    ('public','staff_users','created_at'),
    ('public','staff_roles','id'),
    ('public','staff_roles','name'),
    ('public','staff_roles','description'),
    ('public','staff_roles','built_in'),
    ('public','staff_role_members','id'),
    ('public','staff_role_members','user_id'),
    ('public','staff_role_members','role_id'),
    ('public','staff_role_members','created_at'),
    ('public','staff_role_members','valid_from'),
    ('public','staff_role_members','valid_to'),
    ('public','staff_role_members','granted_via'),
    ('public','staff_role_members','justification'),
    ('public','staff_role_members','ticket_url'),
    ('public','staff_role_permissions','role_id'),
    ('public','staff_role_permissions','permission_key'),
    ('public','staff_permissions','key'),
    ('public','staff_permissions','description'),
    ('public','staff_dual_control_requests','id'),
    ('public','staff_dual_control_requests','action_key'),
    ('public','staff_dual_control_requests','payload'),
    ('public','staff_dual_control_requests','correlation_id'),
    ('public','staff_dual_control_requests','requested_by'),
    ('public','staff_dual_control_requests','approved_by'),
    ('public','staff_dual_control_requests','status'),
    ('public','staff_dual_control_requests','requested_at'),
    ('public','staff_dual_control_requests','approved_at'),
    ('public','staff_dual_control_requests','executed_at'),
    ('public','personal_access_tokens','id'),
    ('public','personal_access_tokens','user_id'),
    ('public','personal_access_tokens','name'),
    ('public','personal_access_tokens','token_hash'),
    ('public','personal_access_tokens','scopes'),
    ('public','personal_access_tokens','created_at'),
    ('public','personal_access_tokens','last_used_at'),
    ('public','personal_access_tokens','expires_at'),
    ('public','personal_access_tokens','revoked'),
    ('public','audit_events','id'),
    ('public','audit_events','happened_at'),
    ('public','audit_events','actor_user_id'),
    ('public','audit_events','actor_email'),
    ('public','audit_events','actor_roles'),
    ('public','audit_events','action'),
    ('public','audit_events','target_type'),
    ('public','audit_events','target_id'),
    ('public','audit_events','resource'),
    ('public','audit_events','ip'),
    ('public','audit_events','user_agent'),
    ('public','audit_events','meta'),
    ('public','inbound_integrations','id'),
    ('public','inbound_integrations','kind'),
    ('public','inbound_integrations','name'),
    ('public','inbound_integrations','secret_hash'),
    ('public','inbound_integrations','secret_ciphertext'),
    ('public','inbound_integrations','enabled'),
    ('public','inbound_integrations','created_at'),
    ('public','inbound_integrations','last_seen_at'),
    ('public','inbound_events','id'),
    ('public','inbound_events','integration_id'),
    ('public','inbound_events','ext_id'),
    ('public','inbound_events','dedup_hash'),
    ('public','inbound_events','received_at'),
    ('public','inbound_events','payload'),
    ('public','investigations','id'),
    ('public','investigations','created_at'),
    ('public','investigations','updated_at'),
    ('public','investigations','title'),
    ('public','investigations','status'),
    ('public','investigations','severity'),
    ('public','investigations','opened_by'),
    ('public','investigations','assigned_to'),
    ('public','investigations','tags'),
    ('public','investigations','summary'),
    ('public','investigation_events','id'),
    ('public','investigation_events','investigation_id'),
    ('public','investigation_events','created_at'),
    ('public','investigation_events','actor_user_id'),
    ('public','investigation_events','kind'),
    ('public','investigation_events','message'),
    ('public','investigation_events','meta'),
    ('public','release_requests','id'),
    ('public','release_requests','title'),
    ('public','release_requests','description'),
    ('public','release_requests','requested_by'),
    ('public','release_requests','status'),
    ('public','release_requests','created_at'),
    ('public','release_requests','last_decision_at'),
    ('public','release_approvals','id'),
    ('public','release_approvals','request_id'),
    ('public','release_approvals','approver_id'),
    ('public','release_approvals','decision'),
    ('public','release_approvals','reason'),
    ('public','release_approvals','created_at'),
    ('public','notification_prefs','id'),
    ('public','notification_prefs','event'),
    ('public','notification_prefs','enabled'),
    ('public','outbound_webhooks','id'),
    ('public','outbound_webhooks','kind'),
    ('public','outbound_webhooks','url'),
    ('public','outbound_webhooks','enabled'),
    ('public','outbound_webhooks','description'),
    ('public','outbound_webhooks','created_at'),
    ('public','outbound_webhooks','secret_key'),
    ('public','secrets','id'),
    ('public','secrets','key'),
    ('public','secrets','env'),
    ('public','secrets','description'),
    ('public','secrets','ciphertext'),
    ('public','secrets','iv'),
    ('public','secrets','aad'),
    ('public','secrets','version'),
    ('public','secrets','requires_dual_control'),
    ('public','secrets','created_by'),
    ('public','secrets','created_at'),
    ('public','secrets','last_rotated_at'),
    ('public','secrets','last_accessed_at'),
    ('public','secret_change_requests','id'),
    ('public','secret_change_requests','key'),
    ('public','secret_change_requests','env'),
    ('public','secret_change_requests','action'),
    ('public','secret_change_requests','proposed_ciphertext'),
    ('public','secret_change_requests','proposed_iv'),
    ('public','secret_change_requests','proposed_aad'),
    ('public','secret_change_requests','reason'),
    ('public','secret_change_requests','requested_by'),
    ('public','secret_change_requests','status'),
    ('public','secret_change_requests','created_at'),
    ('public','secret_change_requests','applied_at'),
    ('public','secret_change_approvals','id'),
    ('public','secret_change_approvals','request_id'),
    ('public','secret_change_approvals','approver_user_id'),
    ('public','secret_change_approvals','created_at'),
    ('public','app_settings','key'),
    ('public','app_settings','value'),
    ('public','app_settings','updated_at'),
    ('public','app_settings','updated_by'),
    ('public','elevation_requests','id'),
    ('public','elevation_requests','created_at'),
    ('public','elevation_requests','requested_by'),
    ('public','elevation_requests','target_user_id'),
    ('public','elevation_requests','roles'),
    ('public','elevation_requests','reason'),
    ('public','elevation_requests','ticket_url'),
    ('public','elevation_requests','window_minutes'),
    ('public','elevation_requests','status'),
    ('public','elevation_requests','executed_at'),
    ('public','elevation_approvals','id'),
    ('public','elevation_approvals','request_id'),
    ('public','elevation_approvals','approver_user_id'),
    ('public','elevation_approvals','created_at'),
    ('public','alerts','id'),
    ('public','alerts','created_at'),
    ('public','alerts','title'),
    ('public','alerts','severity'),
    ('public','alerts','source'),
    ('public','alerts','status'),
    ('public','alerts','owner_email'),
    ('public','app_control','id'),
    ('public','app_control','read_only'),
    ('public','app_control','message')
),
required_indexes(schema_name, index_name) as (
  values
    ('public','idx_staff_role_members_user'),
    ('public','idx_staff_role_members_role'),
    ('public','staff_role_members_user_valid_to_via_idx'),
    ('public','idx_dual_control_status'),
    ('public','personal_access_tokens_user_id_idx'),
    ('public','personal_access_tokens_revoked_expires_at_idx'),
    ('public','personal_access_tokens_last_used_at_idx'),
    ('public','idx_audit_events_happened_at_desc'),
    ('public','idx_audit_events_action'),
    ('public','idx_audit_events_actor_email'),
    ('public','idx_audit_events_target'),
    ('public','idx_inbound_events_integration_received_desc'),
    ('public','idx_inbound_events_dedup_hash'),
    ('public','idx_investigations_updated_at_desc'),
    ('public','idx_investigation_events_investigation_created_desc'),
    ('public','secret_change_requests_status_created_at_idx'),
    ('public','secret_change_approvals_request_idx'),
    ('public','outbound_webhooks_secret_key_idx'),
    ('public','secrets_key_env_idx'),
    ('public','elevation_requests_status_created_at_idx'),
    ('public','alerts_status_created_at_idx')
),
required_views(schema_name, view_name) as (
  values
    ('public','v_investigations_list'),
    ('public','investigation_events_with_actor'),
    ('public','release_requests_with_counts')
),
missing_tables as (
  select 'table' as object_type,
         rt.schema_name || '.' || rt.table_name as object_name
  from required_tables rt
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = rt.schema_name
      and c.relname = rt.table_name
      and c.relkind in ('r', 'p', 'f')
  )
),
missing_columns as (
  select 'column' as object_type,
         rc.schema_name || '.' || rc.table_name || '.' || rc.column_name as object_name
  from required_columns rc
  where not exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = rc.schema_name
      and c.relname = rc.table_name
      and a.attname = rc.column_name
      and a.attnum > 0
      and not a.attisdropped
  )
),
missing_indexes as (
  select 'index' as object_type,
         ri.schema_name || '.' || ri.index_name as object_name
  from required_indexes ri
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ri.schema_name
      and c.relname = ri.index_name
      and c.relkind = 'i'
  )
),
missing_views as (
  select 'view' as object_type,
         rv.schema_name || '.' || rv.view_name as object_name
  from required_views rv
  where not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = rv.schema_name
      and c.relname = rv.view_name
      and c.relkind in ('v', 'm')
  )
)
select *
from (
  select * from missing_tables
  union all
  select * from missing_columns
  union all
  select * from missing_indexes
  union all
  select * from missing_views
) as missing
order by object_type, object_name;
