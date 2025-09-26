
-- torvus-rpc_signing_stubs.sql
-- Purpose: Create SECURITY DEFINER RPC endpoints for signing internals that
--          bypass table RLS safely while enforcing owner-or-service access.
-- Notes:
-- - These assume tables public.signing_jobs(public.id uuid default gen_random_uuid(),
--   owner_id uuid, job jsonb, status text, created_at timestamptz default now())
--   and public.signing_receipts(public.id uuid, owner_id uuid, receipt jsonb, created_at timestamptz).
-- - If your column names differ, adjust SELECT/INSERT field lists accordingly.
-- - Functions pin search_path to pg_temp and must be owned by a superuser/DB owner
--   (postgres) to avoid privilege leaks.
-- - EXECUTE is granted to authenticated and service_role. Do NOT grant to anon.

BEGIN;

-- Helper to detect service_role callers via JWT claims
-- (Supabase sets role='service_role' in the PostgREST JWT when using the service key).
CREATE OR REPLACE FUNCTION public._is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role',
    false
  );
$$;

-- Enqueue a signing job for the current user (or by service role)
CREATE OR REPLACE FUNCTION public.signing_enqueue(job jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_srv boolean := public._is_service_role();
BEGIN
  IF NOT v_srv AND v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.signing_jobs (owner_id, job)
  VALUES (COALESCE(v_uid, gen_random_uuid()), job)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Get a signing job by id (owner or service_role)
CREATE OR REPLACE FUNCTION public.signing_job_get(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_srv boolean := public._is_service_role();
  v_row jsonb;
BEGIN
  IF v_srv THEN
    SELECT to_jsonb(s) INTO v_row
    FROM public.signing_jobs s
    WHERE s.id = p_id;
  ELSE
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT to_jsonb(s) INTO v_row
    FROM public.signing_jobs s
    WHERE s.id = p_id AND s.owner_id = v_uid;
  END IF;

  RETURN v_row;
END;
$$;

-- Get a signing receipt by id (owner or service_role)
CREATE OR REPLACE FUNCTION public.signing_receipt_read(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_srv boolean := public._is_service_role();
  v_row jsonb;
BEGIN
  IF v_srv THEN
    SELECT to_jsonb(r) INTO v_row
    FROM public.signing_receipts r
    WHERE r.id = p_id;
  ELSE
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT to_jsonb(r) INTO v_row
    FROM public.signing_receipts r
    WHERE r.id = p_id AND r.owner_id = v_uid;
  END IF;

  RETURN v_row;
END;
$$;

-- Optional: paginated list for staff console (service_role only)
CREATE OR REPLACE FUNCTION public.signing_jobs_list(p_limit int DEFAULT 50, p_after timestamptz DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_temp
AS $$
BEGIN
  IF NOT public._is_service_role() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(s)
  FROM public.signing_jobs s
  WHERE (p_after IS NULL OR s.created_at > p_after)
  ORDER BY s.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

-- Ensure safe ownership and execution grants
ALTER FUNCTION public._is_service_role()       OWNER TO postgres;
ALTER FUNCTION public.signing_enqueue(jsonb)    OWNER TO postgres;
ALTER FUNCTION public.signing_job_get(uuid)     OWNER TO postgres;
ALTER FUNCTION public.signing_receipt_read(uuid) OWNER TO postgres;
ALTER FUNCTION public.signing_jobs_list(int, timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION public._is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signing_enqueue(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signing_job_get(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signing_receipt_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signing_jobs_list(int, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.signing_enqueue(jsonb)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.signing_job_get(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.signing_receipt_read(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.signing_jobs_list(int, timestamptz) TO service_role;

COMMIT;
