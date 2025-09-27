-- Unified Migration Script for Torvus Platform/Console/MVP
--
-- This single migration consolidates the various schema and policy fixes
-- that were previously split across multiple repositories.  It should be
-- executed once against your Supabase database to normalise row‑level
-- security, update helper functions, rewrite policies to use the
-- planner‑friendly `(SELECT auth.uid())` pattern, remove duplicate
-- indexes and add any missing foreign key indexes.  By running this
-- script, all applications (torvus‑platform, torvus‑console and
-- torvus‑mvp) will interact with a consistent, performant and secure
-- database.

-- ======================================================
-- Step 0 – Replace has_security_admin_role()
--
-- Several migrations in torvus‑console defined a helper function
-- `has_security_admin_role()` that checked staff role membership via
-- `auth.uid()`.  This definition also referenced the non‑existent
-- `staff_user_roles` table, which caused a 42P01 error at runtime.
-- Here we redefine the function to use `staff_role_members` (the
-- correct membership table created by your RBAC migration) and to
-- wrap the uid in a scalar subquery so that the planner can reuse
-- the initial plan.  If you do not use this function, it’s safe
-- to include anyway.
CREATE OR REPLACE FUNCTION public.has_security_admin_role()
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_role_members srm
    JOIN public.staff_roles sr ON sr.id = srm.role_id
    WHERE srm.user_id = (SELECT auth.uid())
      AND sr.name = 'security_admin'
  );
$$;

-- ======================================================
-- Step 1 – Enable and force Row Level Security on all tables
--
-- This block iterates over the union of all user‑facing tables across the
-- platform, console and MVP repositories.  It ensures that RLS is
-- enabled and forced everywhere, so that policies are always applied
-- regardless of role.  Adjust this list if you add new tables.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets', 'audit_events', 'audits',
    'case_archives', 'case_document_labels', 'case_documents',
    'case_inboxes', 'case_intake_tokens', 'case_labels', 'case_policies',
    'case_submissions', 'cases', 'checkins', 'checklists',
    'crypto_accounts', 'death_verifications', 'document_scans',
    'documents', 'estate_cases', 'elevation_approvals', 'elevation_requests',
    'feature_entitlements', 'key_shares', 'legacy_agent_kyc_docs',
    'legacy_agents', 'nft_tokens', 'policies', 'preview_tokens',
    'profiles', 'recipient_verify_tokens', 'recipients',
    'release_batches', 'release_bundles', 'release_decisions',
    'release_items', 'user_capabilities', 'user_plans', 'vaults'
  ] LOOP
    EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE FORMAT('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', t);
  END LOOP;
END$$;

-- ======================================================
-- Step 2 – Rewrite all policies that reference auth.uid()
--
-- Policies created before September 2025 often called `auth.uid()`
-- directly in their USING or WITH CHECK clauses.  This forces the
-- planner to execute the function per row, which can hurt performance.
-- Additionally, some migrations referenced the wrong membership table
-- (`staff_user_roles`).  The following DO block inspects every
-- policy in the `public` schema whose predicate contains `auth.uid()`
-- (case‑insensitive) and recreates it using `(SELECT auth.uid())`.
-- It preserves the policy name, command (SELECT/INSERT/UPDATE/DELETE/ALL),
-- roles and permissive/restrictive mode.  INSERT policies only get
-- a WITH CHECK clause; SELECT/DELETE only get a USING clause;
-- UPDATE/ALL get both.
DO $$
DECLARE
  r RECORD;
  roles_clause TEXT;
  perm_clause TEXT;
  new_qual TEXT;
  new_check TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, LOWER(cmd) AS cmd,
           COALESCE(qual, 'true')       AS qual,
           COALESCE(with_check, 'true') AS with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (
         (qual       IS NOT NULL AND qual       ~* '\bauth\.uid\(\)') OR
         (with_check IS NOT NULL AND with_check ~* '\bauth\.uid\(\)')
       )
  LOOP
    -- Replace all case variations of auth.uid() with (SELECT auth.uid())
    new_qual  := regexp_replace(r.qual, '(?i)\bauth\.uid\(\)', '(SELECT auth.uid())', 'g');
    new_check := regexp_replace(r.with_check, '(?i)\bauth\.uid\(\)', '(SELECT auth.uid())', 'g');

    -- Build roles clause
    IF r.roles IS NULL THEN
      roles_clause := 'TO public';
    ELSE
      roles_clause := 'TO ' || array_to_string(r.roles, ', ');
    END IF;

    -- Permissive or restrictive
    IF r.permissive = 'PERMISSIVE' THEN
      perm_clause := 'permissive';
    ELSE
      perm_clause := 'restrictive';
    END IF;

    -- Build DDL based on command
    IF r.cmd = 'insert' THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS %I ON public.%I;
         CREATE POLICY %I ON public.%I
           AS %s
           FOR INSERT
           %s
           WITH CHECK (%s);',
        r.policyname, r.tablename,
        r.policyname, r.tablename,
        perm_clause,
        roles_clause,
        new_check
      );
    ELSIF r.cmd = 'update' THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS %I ON public.%I;
         CREATE POLICY %I ON public.%I
           AS %s
           FOR UPDATE
           %s
           USING (%s)
           WITH CHECK (%s);',
        r.policyname, r.tablename,
        r.policyname, r.tablename,
        perm_clause,
        roles_clause,
        new_qual,
        new_check
      );
    ELSIF r.cmd = 'select' THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS %I ON public.%I;
         CREATE POLICY %I ON public.%I
           AS %s
           FOR SELECT
           %s
           USING (%s);',
        r.policyname, r.tablename,
        r.policyname, r.tablename,
        perm_clause,
        roles_clause,
        new_qual
      );
    ELSIF r.cmd = 'delete' THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS %I ON public.%I;
         CREATE POLICY %I ON public.%I
           AS %s
           FOR DELETE
           %s
           USING (%s);',
        r.policyname, r.tablename,
        r.policyname, r.tablename,
        perm_clause,
        roles_clause,
        new_qual
      );
    ELSE
      -- ALL or other commands: define both USING and WITH CHECK
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS %I ON public.%I;
         CREATE POLICY %I ON public.%I
           AS %s
           FOR ALL
           %s
           USING (%s)
           WITH CHECK (%s);',
        r.policyname, r.tablename,
        r.policyname, r.tablename,
        perm_clause,
        roles_clause,
        new_qual,
        new_check
      );
    END IF;
  END LOOP;
END$$;

-- ======================================================
-- Step 3 – Drop duplicate non‑unique btree indexes
--
-- Some previous migrations created multiple non‑unique indexes on the same
-- column list.  These duplicates slow down writes and bloat storage.  This
-- block groups indexes by the columns they cover and drops all but the
-- lexicographically smallest name.  Unique indexes are preserved.
DO $$
DECLARE
  rec RECORD;
  keep_idx TEXT;
BEGIN
  FOR rec IN
    WITH idx AS (
      SELECT c.relname            AS index_name,
             t.relname            AS table_name,
             i.indkey[1:array_length(i.indkey,1)] AS attnums,
             i.indrelid
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      WHERE i.indisvalid AND i.indisready AND NOT i.indisunique
        AND c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'i'
    ), grouped AS (
      SELECT table_name,
             attnums,
             array_agg(index_name ORDER BY index_name) AS indexes
      FROM idx
      GROUP BY table_name, attnums
      HAVING COUNT(*) > 1
    )
    SELECT table_name, attnums, indexes
    FROM grouped
  LOOP
    keep_idx := rec.indexes[1];
    FOR i IN 2 .. array_length(rec.indexes,1) LOOP
      EXECUTE FORMAT('DROP INDEX IF EXISTS public.%I;', rec.indexes[i]);
    END LOOP;
  END LOOP;
END$$;

-- ======================================================
-- Step 4 – Create missing foreign‑key indexes
--
-- This block inspects every foreign key in the public schema.  For each
-- foreign key, it determines whether there exists a non‑unique btree index
-- whose leading columns match the foreign key columns.  If none is found,
-- it creates one.  Index names are generated from the table and columns.
DO $$
DECLARE
  rec RECORD;
  idx_name TEXT;
BEGIN
  FOR rec IN
    WITH fk AS (
      SELECT conrelid::regclass AS child_table,
             conkey            AS attnums
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    ), fk_cols AS (
      SELECT f.child_table,
             array_agg(a.attname ORDER BY k.ord) AS colnames,
             f.attnums
      FROM fk f
      CROSS JOIN LATERAL unnest(f.attnums) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = f.child_table AND a.attnum = k.attnum
      GROUP BY f.child_table, f.attnums
    ), idx AS (
      SELECT i.indrelid::regclass AS tbl,
             array_agg(a.attname ORDER BY ord) AS cols
      FROM pg_index i
      CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
      WHERE i.indisvalid AND i.indisready AND NOT i.indisunique
      GROUP BY i.indrelid, i.indkey
    )
    SELECT fk.child_table, fk_cols.colnames
    FROM fk_cols
    JOIN fk ON fk.child_table = fk_cols.child_table AND fk.attnums = fk_cols.attnums
    WHERE NOT EXISTS (
      SELECT 1
      FROM idx
      WHERE idx.tbl = fk.child_table
        AND idx.cols[1:array_length(fk_cols.colnames,1)] = fk_cols.colnames
    )
  LOOP
    idx_name := FORMAT('idx_%s_%s_fk', replace(rec.child_table::text, '.', '_'), array_to_string(rec.colnames, '_'));
    EXECUTE FORMAT(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%s);',
      idx_name,
      rec.child_table,
      array_to_string(ARRAY(SELECT quote_ident(col) FROM unnest(rec.colnames) AS col), ', ')
    );
  END LOOP;
END$$;

-- End of unified migration script