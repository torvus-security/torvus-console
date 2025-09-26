-- 2.1.1 Make sure the views exist before altering.
-- Switch both to security invoker (instead of definer)
ALTER VIEW public.view_documents_ui SET (security_invoker = true);
ALTER VIEW public.view_documents_active SET (security_invoker = true);

-- Optional: add a safety barrier to prevent leaky predicates (good hygiene)
ALTER VIEW public.view_documents_ui SET (security_barrier = true);
ALTER VIEW public.view_documents_active SET (security_barrier = true);

-- Lock down search_path for both functions
ALTER FUNCTION public.set_updated_at() SET search_path = pg_temp;

ALTER FUNCTION public.tg_set_updated_at()
  SET search_path = pg_temp;

-- If these functions reference tables/columns without schema qualifiers,
-- re-create them (DROP/CREATE OR REPLACE) with public.* fully qualified.
-- Example stub (adjust to your exact body):
-- CREATE OR REPLACE FUNCTION public.set_updated_at()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SET search_path = pg_temp
-- AS $$
-- BEGIN
--   NEW.updated_at := now();
--   RETURN NEW;
-- END;
-- $$;
-- Ensure RLS is on (safety)
ALTER TABLE public.signing_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_receipts  ENABLE ROW LEVEL SECURITY;

-- Add explicit deny-all policies (authenticated role shown; repeat for anon if applicable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signing_jobs' AND policyname = 'deny_all_signing_jobs'
  ) THEN
    CREATE POLICY "deny_all_signing_jobs"
      ON public.signing_jobs
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signing_receipts' AND policyname = 'deny_all_signing_receipts'
  ) THEN
    CREATE POLICY "deny_all_signing_receipts"
      ON public.signing_receipts
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

