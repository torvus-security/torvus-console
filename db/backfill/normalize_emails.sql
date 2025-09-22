-- Purpose: Lower-case all staff user emails and enforce future inserts/updates to remain lower-case.
-- Safe run: Execute inside a transaction with service role credentials during a quiet window; the script locks
--           public.staff_users and aborts if any case-insensitive duplicates would collide after normalization.
BEGIN;

LOCK TABLE public.staff_users IN SHARE ROW EXCLUSIVE MODE;

-- Fail fast if multiple accounts would collapse to the same lower-cased email.
DO $$
DECLARE
  conflict record;
BEGIN
  SELECT lower(email) AS normalized_email, array_agg(user_id ORDER BY user_id) AS user_ids
  INTO conflict
  FROM public.staff_users
  GROUP BY lower(email)
  HAVING count(*) > 1
  LIMIT 1;

  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Refusing to normalize staff_users.email due to duplicate lower-cased value: % (user_ids=%)',
      conflict.normalized_email,
      conflict.user_ids;
  END IF;
END $$;

-- Normalize all existing email addresses.
UPDATE public.staff_users
SET email = lower(email)
WHERE email <> lower(email);

-- Replace any pre-existing lower-case enforcement constraint with the latest name.
ALTER TABLE public.staff_users
  DROP CONSTRAINT IF EXISTS staff_users_email_lower_check;

ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_email_lower_check
  CHECK (email = lower(email));

COMMIT;
