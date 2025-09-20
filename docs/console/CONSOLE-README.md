# Torvus Console

Privileged Torvus staff portal with RBAC, dual-control, and evidence-ready audit exports. Deployed as a dedicated Next.js 15 app under `console.torvussecurity.com` behind Zero Trust access.

## Getting started

1. Install dependencies at the repo root (pnpm preferred).
2. Copy `apps/console/.env.example` to `.env.local` inside `apps/console/` and populate Supabase + platform endpoints.
3. Run `pnpm dev:console` from the repo root to start the app on <http://localhost:3000>.
4. Authenticate with Supabase. Staff users must exist in `public.staff_users` with `passkey_enrolled=false` for the first login.

> **Note:** The current passkey flow marks users as enrolled after the acknowledgement step for developer convenience. Replace the stub with the WebAuthn ceremony before production rollout.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE` | Required for Supabase auth + database access |
| `TORVUS_PLATFORM_URL` | Base URL for the production platform (used for redirects + metrics fallback) |
| `TORVUS_PLATFORM_STATS_URL` | Server-side metrics fetch for `/overview` |
| `TORVUS_RELEASE_SIMULATOR_URL` | Optional simulator endpoint consumed by `/releases` |
| `TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION` | Guard for real release execution (kept `0` by default) |
| `NEXT_PUBLIC_STATUSPAGE_PAGE_ID` / `NEXT_PUBLIC_STATUSPAGE_URL` | Configure the embedded status widget |
| `NEXT_PUBLIC_POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_KEY` | Optional analytics proxy configuration |

## Tooling + commands

- `pnpm dev:console` – Run Next.js dev server
- `pnpm build:console` – Production build
- `pnpm start:console` – Start production server
- `pnpm --filter @torvus/console test` – Execute Vitest suite (RBAC, CSP, dual-control)

CI should include the CSP regression test and a headless a11y check before deployment.

## Supabase migrations

Apply migrations with Supabase CLI:

```bash
supabase db push
```

The file `supabase/migrations/20250919_create_staff_rbac.sql` seeds staff roles, permissions, and dual-control tables with RLS locked to the service role.

## Auth + RBAC overview

- Short-lived Supabase sessions (HttpOnly) retrieved via `@supabase/auth-helpers-nextjs`.
- Staff membership fetched via `staff_users`, joining to `staff_role_members`, `staff_roles`, and `staff_role_permissions`.
- `requireStaff()` enforces membership and per-action permission checks.
- Navigation links automatically respect the permission matrix.

Dual-control requests are created via `/api/staff/dual-control/*` (server logic forthcoming) and tracked in `staff_dual_control_requests` with correlation IDs for evidence.

## Auditing + analytics

- Every privileged action captures analytics events using Torvus taxonomy keys (e.g., `audit_events_exported`).
- Audit exports provide both CSV and JSON with timestamped filenames and correlation IDs.
- CSP reports post to `/api/csp-report` (logging stub ready for SIEM integration).

## Feature flags

- `TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION` must remain `0` until dual-control execution is approved.
- Additional feature flags should be modeled as environment variables and audited on change.
