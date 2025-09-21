-- Break-glass elevation support

-- Add temporal and metadata columns to staff_role_members
ALTER TABLE public.staff_role_members
  ADD COLUMN IF NOT EXISTS valid_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to timestamptz NULL,
  ADD COLUMN IF NOT EXISTS granted_via text NOT NULL DEFAULT 'normal' CHECK (granted_via IN ('normal','break_glass')),
  ADD COLUMN IF NOT EXISTS justification text NULL,
  ADD COLUMN IF NOT EXISTS ticket_url text NULL;

-- Requests table captures break-glass elevation requests
CREATE TABLE IF NOT EXISTS public.elevation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roles text[] NOT NULL,
  reason text NOT NULL,
  ticket_url text NULL,
  window_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','expired','revoked')),
  executed_at timestamptz NULL
);

-- Track individual approvals for a request
CREATE TABLE IF NOT EXISTS public.elevation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.elevation_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, approver_user_id)
);

-- Supporting indexes
CREATE INDEX IF NOT EXISTS elevation_requests_status_created_at_idx
  ON public.elevation_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_role_members_user_valid_to_via_idx
  ON public.staff_role_members (user_id, valid_to, granted_via);

-- Row level security policies
ALTER TABLE public.elevation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevation_approvals ENABLE ROW LEVEL SECURITY;

-- Security definer function for checking role membership at current time
CREATE OR REPLACE FUNCTION public.has_security_admin_role()
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_role_members srm
    JOIN public.staff_roles sr ON sr.id = srm.role_id
    WHERE sr.role_name = 'security_admin'
      AND srm.user_id = auth.uid()
      AND (srm.valid_to IS NULL OR srm.valid_to > now())
  );
$$;

CREATE POLICY IF NOT EXISTS elevation_requests_read_policy
  ON public.elevation_requests
  FOR SELECT
  USING (public.has_security_admin_role());

CREATE POLICY IF NOT EXISTS elevation_requests_insert_policy
  ON public.elevation_requests
  FOR INSERT
  WITH CHECK (
    public.has_security_admin_role()
    OR EXISTS (
      SELECT 1
      FROM public.staff_role_members srm
      JOIN public.staff_roles sr ON sr.id = srm.role_id
      WHERE sr.role_name = 'investigator'
        AND srm.user_id = auth.uid()
        AND (srm.valid_to IS NULL OR srm.valid_to > now())
    )
  );

CREATE POLICY IF NOT EXISTS elevation_requests_update_policy
  ON public.elevation_requests
  FOR UPDATE
  USING (public.has_security_admin_role())
  WITH CHECK (public.has_security_admin_role());

CREATE POLICY IF NOT EXISTS elevation_approvals_read_policy
  ON public.elevation_approvals
  FOR SELECT
  USING (public.has_security_admin_role());

CREATE POLICY IF NOT EXISTS elevation_approvals_insert_policy
  ON public.elevation_approvals
  FOR INSERT
  WITH CHECK (public.has_security_admin_role());

REVOKE DELETE ON public.elevation_requests FROM PUBLIC;
REVOKE DELETE ON public.elevation_approvals FROM PUBLIC;
