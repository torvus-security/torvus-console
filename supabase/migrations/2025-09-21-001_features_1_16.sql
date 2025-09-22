BEGIN;

-- Ensure staff_users table exists with required defaults and metadata.
CREATE TABLE IF NOT EXISTS public.staff_users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Torvus Staff',
  passkey_enrolled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Align staff_users columns with expected defaults.
ALTER TABLE public.staff_users
  DROP CONSTRAINT IF EXISTS staff_users_user_id_fkey;

UPDATE public.staff_users
SET display_name = 'Torvus Staff'
WHERE display_name IS NULL;

ALTER TABLE public.staff_users
  ALTER COLUMN user_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN display_name SET DEFAULT 'Torvus Staff',
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS passkey_enrolled boolean NOT NULL DEFAULT false;

ALTER TABLE public.staff_users
  ALTER COLUMN passkey_enrolled SET DEFAULT false,
  ALTER COLUMN passkey_enrolled SET NOT NULL;

ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.staff_users
SET updated_at = COALESCE(updated_at, now());

ALTER TABLE public.staff_users
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure staff_roles table and built_in flag are present.
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  built_in boolean NOT NULL DEFAULT false
);

UPDATE public.staff_roles
SET description = ''
WHERE description IS NULL;

ALTER TABLE public.staff_roles
  ADD COLUMN IF NOT EXISTS built_in boolean,
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;

UPDATE public.staff_roles
SET built_in = false
WHERE built_in IS NULL;

ALTER TABLE public.staff_roles
  ALTER COLUMN built_in SET DEFAULT false;

ALTER TABLE public.staff_roles
  ALTER COLUMN built_in SET NOT NULL;

-- Ensure staff_role_members table tracks temporal validity and provenance.
CREATE TABLE IF NOT EXISTS public.staff_role_members (
  user_id uuid NOT NULL REFERENCES public.staff_users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.staff_roles(id) ON DELETE CASCADE,
  granted_via text NOT NULL DEFAULT 'manual',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  PRIMARY KEY (user_id, role_id, valid_from)
);

ALTER TABLE public.staff_role_members
  ADD COLUMN IF NOT EXISTS granted_via text,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_to timestamptz;

UPDATE public.staff_role_members
SET valid_from = now()
WHERE valid_from IS NULL;

UPDATE public.staff_role_members
SET granted_via = 'manual'
WHERE granted_via IS NULL OR granted_via = 'normal';

ALTER TABLE public.staff_role_members
  DROP CONSTRAINT IF EXISTS staff_role_members_granted_via_check,
  ALTER COLUMN granted_via SET DEFAULT 'manual',
  ALTER COLUMN granted_via SET NOT NULL,
  ALTER COLUMN valid_from SET DEFAULT now(),
  ALTER COLUMN valid_from SET NOT NULL,
  ALTER COLUMN valid_to DROP NOT NULL;

ALTER TABLE public.staff_role_members
  DROP CONSTRAINT IF EXISTS staff_role_members_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_role_members_pk'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff_role_members
              ADD CONSTRAINT staff_role_members_pk
              PRIMARY KEY (user_id, role_id, valid_from)';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_role_members_active_ux
  ON public.staff_role_members (user_id, role_id)
  WHERE valid_to IS NULL;

-- Maintain an effective roles view for current memberships.
CREATE OR REPLACE VIEW public.v_effective_roles AS
SELECT
  m.user_id,
  m.role_id,
  r.name AS role_name
FROM public.staff_role_members AS m
JOIN public.staff_roles AS r ON r.id = m.role_id
WHERE now() BETWEEN m.valid_from AND COALESCE(m.valid_to, 'infinity'::timestamptz);

-- Align elevation_requests table with requester centric workflow.
CREATE TABLE IF NOT EXISTS public.elevation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES public.staff_users(user_id) ON DELETE RESTRICT,
  reason text NOT NULL,
  requested_roles text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz NULL,
  expires_at timestamptz NULL,
  executed_by uuid NULL REFERENCES public.staff_users(user_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'elevation_requests'
      AND column_name = 'requested_by'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_requests RENAME COLUMN requested_by TO requester_user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'elevation_requests'
      AND column_name = 'roles'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_requests RENAME COLUMN roles TO requested_roles';
  END IF;
END $$;

ALTER TABLE public.elevation_requests
  ADD COLUMN IF NOT EXISTS requester_user_id uuid,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS requested_roles text[],
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_by uuid;

ALTER TABLE public.elevation_requests
  DROP COLUMN IF EXISTS target_user_id,
  DROP COLUMN IF EXISTS ticket_url,
  DROP COLUMN IF EXISTS window_minutes;

ALTER TABLE public.elevation_requests
  ALTER COLUMN requester_user_id SET NOT NULL,
  ALTER COLUMN reason SET NOT NULL,
  ALTER COLUMN requested_roles SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.elevation_requests
  DROP CONSTRAINT IF EXISTS elevation_requests_requested_by_fkey,
  DROP CONSTRAINT IF EXISTS elevation_requests_requester_user_id_fkey,
  DROP CONSTRAINT IF EXISTS elevation_requests_target_user_id_fkey,
  DROP CONSTRAINT IF EXISTS elevation_requests_executed_by_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'elevation_requests_requester_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_requests
              ADD CONSTRAINT elevation_requests_requester_user_id_fkey
              FOREIGN KEY (requester_user_id)
              REFERENCES public.staff_users(user_id)
              ON DELETE RESTRICT';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'elevation_requests_executed_by_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_requests
              ADD CONSTRAINT elevation_requests_executed_by_fkey
              FOREIGN KEY (executed_by)
              REFERENCES public.staff_users(user_id)';
  END IF;
END $$;

-- Elevation approvals capture reviewer decisions.
CREATE TABLE IF NOT EXISTS public.elevation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.elevation_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES public.staff_users(user_id) ON DELETE RESTRICT,
  decision text NOT NULL,
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elevation_approvals
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS approver_user_id uuid,
  ADD COLUMN IF NOT EXISTS decision text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.elevation_approvals
SET decision = 'approved'
WHERE decision IS NULL;

ALTER TABLE public.elevation_approvals
  ALTER COLUMN request_id SET NOT NULL,
  ALTER COLUMN approver_user_id SET NOT NULL,
  ALTER COLUMN decision SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.elevation_approvals
  ALTER COLUMN decision DROP DEFAULT;

ALTER TABLE public.elevation_approvals
  DROP CONSTRAINT IF EXISTS elevation_approvals_request_id_fkey,
  DROP CONSTRAINT IF EXISTS elevation_approvals_request_id_fkey1,
  DROP CONSTRAINT IF EXISTS elevation_approvals_approver_user_id_fkey,
  DROP CONSTRAINT IF EXISTS elevation_approvals_approver_user_id_fkey1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'elevation_approvals_request_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_approvals
              ADD CONSTRAINT elevation_approvals_request_id_fkey
              FOREIGN KEY (request_id)
              REFERENCES public.elevation_requests(id)
              ON DELETE CASCADE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'elevation_approvals_approver_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.elevation_approvals
              ADD CONSTRAINT elevation_approvals_approver_user_id_fkey
              FOREIGN KEY (approver_user_id)
              REFERENCES public.staff_users(user_id)
              ON DELETE RESTRICT';
  END IF;
END $$;

-- Inbound webhook logging for replay protection and auditing.
CREATE TABLE IF NOT EXISTS public.webhooks_inbound_log (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  digest text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  http_status int NULL,
  status text NOT NULL DEFAULT 'received',
  headers jsonb NULL,
  body jsonb NULL,
  ip inet NULL,
  replayed boolean NOT NULL DEFAULT false
);

-- Secure secret storage with rotation metadata.
CREATE TABLE IF NOT EXISTS public.secrets_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value_encrypted bytea NOT NULL,
  version int NOT NULL DEFAULT 1,
  rotated_at timestamptz NULL,
  rotated_by uuid NULL REFERENCES public.staff_users(user_id)
);

CREATE TABLE IF NOT EXISTS public.secrets_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  new_value_encrypted bytea NOT NULL,
  created_by uuid NOT NULL REFERENCES public.staff_users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NULL REFERENCES public.staff_users(user_id),
  approved_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  effective_at timestamptz NULL
);

-- Singleton app control gate for maintenance modes.
CREATE TABLE IF NOT EXISTS public.app_control (
  id smallint PRIMARY KEY DEFAULT 1,
  read_only boolean NOT NULL DEFAULT false,
  message text NULL,
  CONSTRAINT app_control_singleton CHECK (id = 1)
);

-- Baseline role catalog with built_in flag maintained via upsert.
INSERT INTO public.staff_roles (name, description, built_in)
VALUES
  ('security_admin', 'Full administration of console', true),
  ('auditor', 'Read-only access to console data', true),
  ('investigator', 'Operational investigations', true),
  ('operator', 'Operational actions', true),
  ('break_glass', 'Emergency elevated role (dual-control enforced)', true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    built_in = EXCLUDED.built_in;

-- Updated-at trigger helper for staff_users.
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_staff_users ON public.staff_users;

CREATE TRIGGER set_updated_at_staff_users
BEFORE UPDATE ON public.staff_users
FOR EACH ROW
EXECUTE PROCEDURE public.tg_set_updated_at();

-- Seed the application control singleton row if missing.
INSERT INTO public.app_control (id, read_only)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
