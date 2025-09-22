-- Purpose: Transition any elevation requests past their expires_at into an 'expired' terminal state.
-- Safe run: Execute inside a transaction with service role credentials; the script locks public.elevation_requests
--           and reports which requests were updated so the operator can confirm the changes.
BEGIN;

LOCK TABLE public.elevation_requests IN SHARE ROW EXCLUSIVE MODE;

WITH updated AS (
  UPDATE public.elevation_requests AS er
  SET status = 'expired'
  WHERE er.expires_at IS NOT NULL
    AND er.expires_at < now()
    AND er.status IN ('pending', 'approved')
  RETURNING er.id, er.requester_user_id, er.requested_roles, er.status, er.expires_at
)
SELECT * FROM updated ORDER BY expires_at;

COMMIT;
