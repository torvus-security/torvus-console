-- Release requests and approvals tables
create table if not exists public.release_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  requested_by uuid not null references public.staff_users(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed')),
  created_at timestamptz not null default now(),
  last_decision_at timestamptz
);

create table if not exists public.release_approvals (
  id bigserial primary key,
  request_id uuid not null references public.release_requests(id) on delete cascade,
  approver_id uuid not null references public.staff_users(user_id) on delete restrict,
  decision text not null check (decision in ('approve','reject')),
  reason text,
  created_at timestamptz not null default now(),
  unique (request_id, approver_id)
);

create or replace view public.release_requests_with_counts as
select rr.*,
       count(*) filter (where ra.decision = 'approve') as approve_count,
       count(*) filter (where ra.decision = 'reject')  as reject_count
from public.release_requests rr
left join public.release_approvals ra on ra.request_id = rr.id
group by rr.id;

comment on view public.release_requests_with_counts is 'Release requests with approval/reject counts';
