with staff_ordered as (
  select user_id, row_number() over (order by created_at) as rn
  from public.staff_users
),
open_seed as (
  select
    (select user_id from staff_ordered where rn = 1) as opened_by,
    (select user_id from staff_ordered where rn = 2) as assigned_to
),
progress_seed as (
  select
    coalesce((select user_id from staff_ordered where rn = 2), (select user_id from staff_ordered where rn = 1)) as opened_by,
    coalesce((select user_id from staff_ordered where rn = 3), (select user_id from staff_ordered where rn = 1)) as assigned_to
),
closed_seed as (
  select
    coalesce((select user_id from staff_ordered where rn = 3), (select user_id from staff_ordered where rn = 1)) as opened_by
)
insert into public.investigations (id, title, status, severity, opened_by, assigned_to, tags, summary)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001'::uuid,
  'Endpoint malware triage',
  'open',
  'high',
  open_seed.opened_by,
  open_seed.assigned_to,
  array['endpoint','malware'],
  'Indicators of compromise detected on workstation T-445.'
from open_seed
where open_seed.opened_by is not null
on conflict (id) do nothing;

with staff_ordered as (
  select user_id, row_number() over (order by created_at) as rn
  from public.staff_users
),
progress_seed as (
  select
    coalesce((select user_id from staff_ordered where rn = 2), (select user_id from staff_ordered where rn = 1)) as opened_by,
    coalesce((select user_id from staff_ordered where rn = 3), (select user_id from staff_ordered where rn = 1)) as assigned_to
)
insert into public.investigations (id, title, status, severity, opened_by, assigned_to, tags, summary)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'::uuid,
  'Suspicious access review',
  'in_progress',
  'medium',
  progress_seed.opened_by,
  progress_seed.assigned_to,
  array['access','iam'],
  'Reviewing anomalous Okta session originating from foreign ASN.'
from progress_seed
where progress_seed.opened_by is not null
on conflict (id) do nothing;

with staff_ordered as (
  select user_id, row_number() over (order by created_at) as rn
  from public.staff_users
),
closed_seed as (
  select
    coalesce((select user_id from staff_ordered where rn = 3), (select user_id from staff_ordered where rn = 1)) as opened_by
)
insert into public.investigations (id, title, status, severity, opened_by, assigned_to, tags, summary)
select
  'cccccccc-cccc-4ccc-8ccc-cccccccc0003'::uuid,
  'Vendor phishing follow-up',
  'closed',
  'low',
  closed_seed.opened_by,
  null,
  array['phishing','vendor'],
  'Confirmed vendor simulation; case closed with awareness reminder.'
from closed_seed
where closed_seed.opened_by is not null
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0101'::uuid,
  inv.id,
  inv.opened_by,
  'note',
  'Initial containment steps executed: host isolated from network.',
  jsonb_build_object('seed', true, 'order', 1)
from public.investigations inv
where inv.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001'
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0102'::uuid,
  inv.id,
  coalesce(inv.assigned_to, inv.opened_by),
  'note',
  'Collected memory image for malware triage. Awaiting sandbox verdict.',
  jsonb_build_object('seed', true, 'order', 2)
from public.investigations inv
where inv.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001'
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0201'::uuid,
  inv.id,
  inv.opened_by,
  'note',
  'Coordinated with IAM to rotate credentials and force sign-out.',
  jsonb_build_object('seed', true, 'order', 1)
from public.investigations inv
where inv.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0202'::uuid,
  inv.id,
  coalesce(inv.assigned_to, inv.opened_by),
  'note',
  'Awaiting geo-verification from user before closing access exception.',
  jsonb_build_object('seed', true, 'order', 2)
from public.investigations inv
where inv.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'cccccccc-cccc-4ccc-8ccc-cccccccc0301'::uuid,
  inv.id,
  inv.opened_by,
  'note',
  'Confirmed simulated phishing campaign. No compromise observed.',
  jsonb_build_object('seed', true, 'order', 1)
from public.investigations inv
where inv.id = 'cccccccc-cccc-4ccc-8ccc-cccccccc0003'
on conflict (id) do nothing;

insert into public.investigation_events (id, investigation_id, actor_user_id, kind, message, meta)
select
  'cccccccc-cccc-4ccc-8ccc-cccccccc0302'::uuid,
  inv.id,
  inv.opened_by,
  'note',
  'Closed case after notifying vendor security contact.',
  jsonb_build_object('seed', true, 'order', 2)
from public.investigations inv
where inv.id = 'cccccccc-cccc-4ccc-8ccc-cccccccc0003'
on conflict (id) do nothing;
