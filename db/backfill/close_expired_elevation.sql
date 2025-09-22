-- Mark expired elevation requests as expired to align status with their expiry timestamps.
-- Run during low-traffic periods: psql -f db/backfill/close_expired_elevation.sql
BEGIN;

UPDATE elevation_requests
SET status = 'expired'
WHERE expires_at < NOW()
  AND status IN ('pending', 'approved');

COMMIT;
