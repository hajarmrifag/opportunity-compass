# Roadmap
- [x] Audit current files/contracts; preserve teammate changes
- [x] Profile edits invalidate confirmation; unknown never passes
- [x] Expiry distinct from eligibility; invalid deadlines/URLs handled
- [x] Keyboard/mobile audit
- [x] CSV tracker import/export (template, mapping, preview, validation, dupes, confirm, quoting, formula-injection guard)
- [x] docs/TEAM_INTEGRATION.md
- [x] docs/QA_CHECKLIST.md
- [x] docs/DEMO_SCRIPT.md
- [x] docs/AUTH_DB_PLAN.md (per-user RLS, provenance, migration/rollback, isolation tests, approvals) — plan only, no backend
- [x] Typecheck, unit tests, browser tests (core + mobile); final report
- [x] Fix off-by-one days-left (calendar-day diff in local tz, no hardcoded today); test it
- [x] Dashboard: deadline list window = 14-day count; record in QA
- [x] Fix 'useStore outside StoreProvider' blank screen (HMR context identity); verify reload + direct routes
- [x] Repair template routing tests' setup (no skip/weakening)
- [x] Unsaved Passport edits: label eligibility as based on last confirmed Passport
- [x] Full tests, typecheck, prod build; record in QA doc
- [ ] Live web opportunity search (server-side, managed Firecrawl; inactive until connector approved): NL query + filters (category incl. jobs/masters, location/remote, subject, education, funding, deadline), source URL + retrievedAt, dedupe, open/closed/unknown, save-to-tracker, bounded/cached/rate-limited/cancellable, no demo fallback, no PII sent
- [ ] Document exact connector/Cloud permissions + cost before activation (docs/LIVE_SEARCH.md)
- [ ] Validate real search→source→save once connected (blocked on approval)

## Live search
- [x] Server search + mapping + caching/rate limit/cancel
- [x] /search UI with filters, save to tracker
- [x] Tests (28 pass), build, docs/LIVE_SEARCH.md
- [ ] Real search validation — blocked: Firecrawl connector approval
