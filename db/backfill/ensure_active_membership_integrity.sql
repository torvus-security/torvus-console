-- Purpose: Ensure only a single active membership exists per (user, role) by closing older duplicates.
-- Safe run: Execute inside a transaction with service role credentials; the script locks public.staff_role_members
--           and sets valid_to=now() on any but the most recent active rows, returning the rows it closed.
BEGIN;

LOCK TABLE public.staff_role_members IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT
    ctid,
    user_id,
    role_id,
    valid_from,
    created_at,
    row_number() OVER (
      PARTITION BY user_id, role_id
      ORDER BY COALESCE(valid_from, created_at) DESC, created_at DESC, ctid DESC
    ) AS rn
  FROM public.staff_role_members
  WHERE valid_to IS NULL
),
closed AS (
  UPDATE public.staff_role_members AS m
  SET valid_to = now()
  FROM ranked r
  WHERE m.ctid = r.ctid
    AND r.rn > 1
  RETURNING m.user_id, m.role_id, COALESCE(m.valid_from, m.created_at) AS closed_from, m.valid_to
)
SELECT * FROM closed ORDER BY user_id, role_id, closed_from;

COMMIT;
