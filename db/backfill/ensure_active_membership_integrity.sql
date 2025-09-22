-- Close out older overlapping active staff role memberships to keep only the most recent one per role.
-- Execute in a controlled window: psql -f db/backfill/ensure_active_membership_integrity.sql
BEGIN;

WITH ranked_memberships AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY staff_user_id, staff_role_id
               ORDER BY COALESCE(valid_from, TIMESTAMP 'epoch') DESC, id DESC
           ) AS rn
    FROM staff_role_members
    WHERE valid_to IS NULL
)
UPDATE staff_role_members srm
SET valid_to = NOW()
FROM ranked_memberships dupes
WHERE srm.id = dupes.id
  AND dupes.rn > 1;

COMMIT;
