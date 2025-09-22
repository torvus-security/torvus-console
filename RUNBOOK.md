# Database Verification Runbook

Follow these steps in the Supabase SQL editor after applying a migration set.

## 1. Structural checklist
1. Open the SQL editor and paste the contents of [`db/verify/checklist.sql`](db/verify/checklist.sql).
2. Execute the script.
3. **Expected result:** the query returns **zero rows**. Any returned rows list missing tables, columns, indexes, or views that must be addressed before proceeding.

## 2. Post-apply smoke checks
1. Replace `{{EMAIL}}` in [`db/verify/post_apply_smoke.sql`](db/verify/post_apply_smoke.sql) with the staff email you want to inspect (lower/upper case does not matter).
2. Run the entire script in the SQL editor.
3. **Result set interpretation:**
   - The first result set should be empty. If it contains rows, the named `staff_roles` seeds are missing.
   - The second result set should list the five built-in roles with their descriptions/built-in flags.
   - The third result set should be empty. If it returns a row, the `public.app_control` singleton is missing.
   - The fourth result set should show the singleton record with `id = 1`, including its `read_only` status and message.
   - The final result set lists the effective roles for the supplied email; it can be empty if the staff user has no active roles.

4. Investigate and fix any discrepancies before sign-off.
