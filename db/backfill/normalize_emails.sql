-- Lower-case all existing staff user email addresses and add a guard to keep them normalized.
-- Run inside a transaction in a maintenance window: psql -f db/backfill/normalize_emails.sql
BEGIN;

UPDATE staff_users
SET email = LOWER(email)
WHERE email <> LOWER(email);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'staff_users_email_lowercase_chk'
          AND conrelid = 'staff_users'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE staff_users
                 ADD CONSTRAINT staff_users_email_lowercase_chk
                 CHECK (email = lower(email))';
    END IF;
END
$$;

COMMIT;
