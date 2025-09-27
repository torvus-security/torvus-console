Torvus Console — In Production

This repository has been simplified to a single static landing page while the console is in production.

- Open `index.html` directly in a browser, or
- Serve the folder with any static server.

## Database Migration Overview

Recent database migrations introduced a consolidated approach to Row Level Security (RLS) and indexing across the Torvus platform:

- **Planner-friendly `(SELECT auth.uid())` calls** – Every RLS policy now invokes the authenticated user through the planner-stable form `(SELECT auth.uid())`. This avoids inlining the function call into generated plans, ensuring PostgreSQL can cache and reuse query plans efficiently even when policies reference the current user ID.
- **Single permissive policy per table/command** – Policies have been consolidated so that each table has at most one permissive policy per command (e.g., `SELECT`, `INSERT`). This reduces policy evaluation complexity, makes intent clearer, and prevents overlapping permissive rules from accidentally widening access.
- **RLS enforced everywhere** – RLS is enabled and forced on all core user-data tables, including the Torvus MVP schemas. This guarantees that access always flows through the defined policies and cannot be bypassed by misconfigured roles.
- **Foreign-key index coverage** – Redundant btree indexes were removed and missing indexes for foreign-key columns were added. Indexing FK columns keeps constraint checks efficient, improves join performance, and avoids table-wide locks during cascading updates or deletes.
- **Shared migration entry points** – New migration bundles such as `torvus-platform-migration.sql` include the policy updates, index changes, and the updated `has_security_admin_role()` function that now uses `(SELECT auth.uid())` internally.

To apply the latest schema changes, ensure your deployment pipeline runs the new SQL bundles (e.g., `torvus-platform-migration.sql`) before promoting the release.

Contact: support@torvus.app
