# Auth + Shared Database Integration Plan (not implemented)

Status: **plan only.** No backend is enabled, no permissions changed, nothing purchased or published. Implementing this requires the approvals in §7.

## 1. Goal
Replace `localRepository` (`src/data/storage.ts`) with a per-user remote repository while keeping the UI and the `Repository`/contract shapes unchanged.

## 2. Target data model (Postgres)

| Table | Purpose | Access |
|---|---|---|
| `profiles` (1 row per user; `user_id uuid pk -> auth.users`, Profile columns, `confirmed`, `confirmed_at`, `source`) | private Passport | owner only |
| `applications` (`id`, `user_id`, `opportunity_id`, `status`, `notes`, `deadline date`, timestamps; `unique(user_id, opportunity_id)`) | private tracker; unique constraint = server-side idempotent save | owner only |
| `application_events` (`application_id`, `status`, `at`) | status history | owner only (via join) |
| `user_opportunities` (manual / CSV-imported; `user_id`, Opportunity columns, `verification='user_entered'`) | private custom entries | owner only |
| `catalog_opportunities` (Opportunity columns + provenance: `source_url`, `last_verified`, `verification`, `verified_by`, `ingested_at`, `is_demo`) | shared catalog | read: authenticated; write: service role / curator role only |
| `user_roles` (`user_id`, `role app_role`) + `has_role()` security-definer fn | curator/admin rights; never on profiles | read own |

Catalog provenance rules: a check constraint makes `verification='verified'` require non-null `source_url` and `last_verified`; `is_demo=true` rows require `verification='demo_unverified'`.

## 3. Row-level access
- Every user table: `GRANT select, insert, update, delete ... TO authenticated`, `ENABLE ROW LEVEL SECURITY`, policies `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. No `anon` grants.
- `catalog_opportunities`: `GRANT select TO authenticated`; insert/update only via `has_role(auth.uid(),'curator')` or service-role ingestion jobs.
- `user_id` defaults to `auth.uid()` and is non-nullable; the client never sends it.

## 4. No client secrets
- Browser uses only the publishable key + user session; all writes are subject to RLS.
- Verified-data ingestion and funding-intelligence jobs run server-side (server functions / scheduled routes) with the service key read from server env inside handlers. No service key, AI key or provider key in client code or `VITE_*` vars.

## 5. Code changes (additive)
1. `src/data/remoteRepository.ts` implementing an **async** variant: add `AsyncRepository { load(): Promise<...>; save...}` additively; `StoreProvider` picks it when signed in, keeps `localRepository` for signed-out/demo mode.
2. Replace whole-state `save()` with granular methods (`upsertApplication`, `saveProfile`, ...) to avoid last-write-wins across devices; keep the old method for local mode.
3. Sign-in page + session-aware header; tracker/passport routes move under a protected layout.
4. One-time "Import my browser data" action: reads local state, shows a preview (reusing the CSV preview/duplicate logic), user confirms, then uploads. Local data is kept until the user clears it.

## 6. Migration & rollback
- Migrations are additive (new tables/policies only); nothing existing is dropped.
- Feature flag `REMOTE_STORAGE` (default off). Rollback = flag off → app returns to localStorage; remote tables remain untouched.
- Down-migration script prepared separately (drop new tables) but only run after data export, with approval.
- `STORAGE_VERSION` stays 1 for local; remote rows carry a `schema_version` column.

## 7. Approvals needed before implementation
- Enable Lovable Cloud (backend, database, auth) — project owner.
- Choose sign-in methods (email / Google) — product decision.
- Agree who holds the curator role and who runs ingestion.
- Data-protection review: student profiles are personal data; define retention + deletion ("delete my account" must cascade).
- No paid services or publishing are required for this step.

## 8. Tests proving cross-user isolation
Automated (run against a test project with two seeded users A and B):
1. A inserts profile/application → B `select` returns 0 rows; B `update`/`delete` by id affects 0 rows.
2. B inserting a row with `user_id = A` is rejected by `WITH CHECK`.
3. Anonymous (no session) `select` on every user table returns permission error.
4. Authenticated non-curator insert into `catalog_opportunities` is rejected; read succeeds.
5. Double insert of `(user, opportunity)` returns conflict → client treats as existing (idempotent save).
6. Catalog check constraint rejects `verified` row without `source_url`/`last_verified`.
7. Account deletion cascades all owned rows.
Plus a Playwright run signed in as A then B confirming B's My Journey does not show A's items.
