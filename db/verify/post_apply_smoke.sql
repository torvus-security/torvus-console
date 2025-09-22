-- Post-apply smoke checks for Torvus Console schema.

-- 1. Ensure built-in staff roles are present. Any rows returned indicate missing roles.
with required_roles(role_name) as (
  values
    ('security_admin'),
    ('auditor'),
    ('investigator'),
    ('operator'),
    ('break_glass')
)
select 'missing_staff_role' as issue, rr.role_name as detail
from required_roles rr
left join public.staff_roles sr on sr.name = rr.role_name
where sr.id is null;

-- Helpful view of current role rows (should include all required roles above).
select name, description, built_in
from public.staff_roles
where name in ('security_admin','auditor','investigator','operator','break_glass')
order by name;

-- 2. Verify the application control singleton row exists.
select 'missing_app_control_row' as issue, 'public.app_control id=1' as detail
where not exists (
  select 1 from public.app_control where id = 1
);

select id, read_only, message
from public.app_control
where id = 1;

-- 3. Resolve effective roles for the supplied email (replace {{EMAIL}} before running).
select distinct sr.name as effective_role
from public.staff_users su
join public.staff_role_members srm on srm.user_id = su.user_id
join public.staff_roles sr on sr.id = srm.role_id
where lower(su.email) = lower('{{EMAIL}}')
  and coalesce(srm.granted_via, 'normal') in ('normal','break_glass')
  and coalesce(srm.valid_from, now()) <= now()
  and (srm.valid_to is null or srm.valid_to > now())
order by effective_role;
