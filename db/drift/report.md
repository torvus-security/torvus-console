# Schema Drift Report

## Missing structures

- **public.alerts** — The console queries `alerts` for open items and counts, expecting columns `id`, `created_at`, `title`, `severity`, `source`, `status`, and `owner_email` with status filtering and ordering by `created_at`.【F:apps/console/lib/data/alerts.ts†L1-L70】 No Supabase migration creates this table, so it must be added.

## Table shape mismatches

- **public.staff_role_members** — Break-glass workflows load and mutate memberships by a surrogate `id` column when revoking temporary grants.【F:apps/console/server/breakglass.ts†L340-L399】 The migrations still define the table with only a composite primary key on `(user_id, role_id)` and no `id`, preventing those queries from succeeding. Add a generated `id` (UUID) column while keeping a unique constraint on `(user_id, role_id)`.

- **public.audit_events** — Two code paths expect different column names: the API/export layer uses the new shape (`happened_at`, `actor_email`, `actor_roles`, `action`, etc.),【F:apps/console/server/audit-data.ts†L100-L195】【F:apps/console/app/api/audit/export/route.ts†L1-L147】 while the React page and legacy export helpers still query `audit_events` for legacy columns (`actor`, `event`, `created_at`, `object`, `metadata`).【F:apps/console/app/audit-events/page.tsx†L13-L170】【F:apps/console/app/audit-events/actions.ts†L9-L66】 The current table only provides the new column set per migration, so either compatible generated columns or a compatibility view must be introduced to satisfy both shapes without breaking existing inserts.

## Recommended migration checklist

1. Create `public.alerts` with the columns listed above, primary key on `id`, and an index on `(status, created_at DESC)` to support the console queries.
2. Alter `public.staff_role_members` to add a UUID `id` column as the primary key (default `gen_random_uuid()`), retain a unique constraint on `(user_id, role_id)`, and backfill existing rows. Update related indexes to reference the new structure.
3. Extend `public.audit_events` with compatibility columns (e.g. generated columns or a view) so both legacy (`actor`, `event`, `created_at`, `object`, `metadata`) and new (`happened_at`, etc.) selectors succeed.

