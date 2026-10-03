# QA checklist — milestone 1 (draft, 3 Oct 2026)

Environments: dev preview, Chromium (Playwright) at 1280×1800 and 390×844, timezone Asia/Hong_Kong. Unit tests are also run with TZ = Asia/Hong_Kong, America/Los_Angeles, UTC, Pacific/Kiritimati.

## Automated
| Check | Result | Evidence |
|---|---|---|
| TypeScript (`tsgo --noEmit`) | PASS | no output |
| `src/test/core.test.ts` (16 tests: CSV quoting/BOM/CRLF/unterminated quote, formula neutralization, date + URL validation, calendar-day countdown incl. DST, expiry≠eligibility, unconfirmed/missing → unknown, `other` stays unknown, profile edit recomputes, fixture honesty, CSV alias mapping, dedupe/actions, export/template parse) | PASS in all 4 TZs | `TZ=… bunx vitest run src/test/core.test.ts` → 16 passed |
| `src/test/app-routing.test.tsx` (template test) | PASS (repaired) | Was failing because the root `shellComponent` renders `<html>` and the test mounted it inside a `<div>` before any route match existed. Fix: the test now resolves the router first (`await router.load()`, as SSR does) and mounts into `document`. No tests skipped. Assertions kept, plus stronger ones: `<main>` exists on `/`, and "Page not found" shows on an unknown path. |

## Final gate run (06:4x UTC, 3 Oct 2026)
```
$ tsgo --noEmit            -> exit 0, no output
$ bunx vitest run          -> Test Files 2 passed (2); Tests 18 passed (18)
                              (core.test.ts 16, app-routing.test.tsx 2)
$ bun run build            -> exit 0 ("✓ built" for all 3 bundles; no errors)
```
Known harmless test-only warning: React logs `href=""` for the stylesheet link, because Vite's `?url` import resolves to an empty string under vitest.

## Browser (Playwright, scripted)
| Flow | Result | Evidence |
|---|---|---|
| Confirm with empty Passport blocked, field errors shown | PASS | 4 field errors (milestone run) |
| Demo profile loads **unconfirmed**; explicit confirm required | PASS | "Not confirmed" chip present |
| Editing a confirmed Passport shows "Unsaved edits — confirm again"; Save draft un-confirms | PASS | chip present; status → Not confirmed |
| Eligibility recomputes after edit (field → Biology makes Coastal Research "Meets all listed demo criteria") | PASS | text found |
| Countdown: 3 Oct (HKT) → 20 Oct shows **17 days left** | PASS (fixed) | detail header text |
| Save twice → one tracker item | PASS | 1 item |
| Status Submitted + note persist after refresh | PASS | select = submitted; note kept |
| CSV import: quoted comma title, in-file duplicate skipped, already-tracked skipped, invalid row (bad category, 2026-02-31, `javascript:` URL, missing title) rejected; explicit confirm; persists after reload | PASS | preview "1 new · 0 track · 0 update · 2 skip · 1 with errors"; journey shows 2 items after reload |
| CSV export neutralizes formulas and quotes commas | PASS | `"'=HYPERLINK(""x"")"`, `"Lisbon, Portugal"` |
| Keyboard: first Tab focuses "Skip to content"; visible focus ring | PASS | activeElement text |
| Mobile 390px: bottom nav, no horizontal overflow | PASS | `scrollWidth > innerWidth` = false; screenshot |
| No runtime page errors | PASS | errors: [] |

## Independent UI checks reported by the team (preview)
- Incomplete Passport blocked — PASS
- Demo profile unconfirmed until explicit confirmation — PASS
- Nonsense search → 0 results; clear → six — PASS
- Portugal work-rights Unknown, shown separately from High relevance — PASS
- Save creates one tracker item — PASS
- Explicit Submitted + note persist through refresh — PASS
- **Found:** 20 Oct showed "18 days left" on 3 Oct HKT (calendar difference 17). **Cause:** compared against 23:59:59 of the deadline using `ceil` on elapsed ms. **Fix:** `deadlineState` now compares local-midnight dates with `round` (DST-safe). No hardcoded "today"; the tests inject `now`. **Retested:** PASS.
- **Found:** Dashboard "Approaching deadlines" listed 20 Oct while the "≤14 days" count was 0. **Fix:** one constant `DEADLINE_WINDOW_DAYS = 14` drives the heading ("Deadlines in the next 14 days"), the list filter, the stat and the "closing soon" chip. **Retested:** PASS (list and count both 0 when nothing is within 14 days).

- **Found (preview):** RUNTIME_ERROR "useStore must be used inside StoreProvider" from AppShell, blank screen. **Cause:** after a live code reload the store module was re-evaluated and created a new context object, so the mounted provider and the reloaded consumers no longer matched. Provider placement in `__root.tsx` was already correct. **Fix:** the context is created once and reused across reloads (`globalThis` cache in `src/lib/store.tsx`). **Retested:** PASS. A forced live reload while on My Journey kept rendering. Direct loads of `/`, `/discover`, `/opportunities/demo-nordlys-exchange`, `/opportunities/nope` ("not found" state), `/journey`, `/passport`, `/add`, `/tracker-io` and `/bogus` (404) all rendered; client navigation and full refresh worked; 0 page errors.

- **Stale eligibility vs unsaved Passport edits:** unsaved edits are now kept as an in-memory draft that is never used for eligibility. The Passport shows "Unsaved edits — eligibility still uses your last confirmed Passport until you confirm again". Every opportunity detail shows "Checked against your Passport confirmed <time>" and, while edits are pending, a notice that the results reflect the last confirmed Passport, not the edits, with a "Review and confirm" link that restores the draft. **Browser test PASS:** edit field to Biology → detail shows the notice and still "not met" (old) → Review and confirm restores "Biology" → confirm → "Meets all listed demo criteria" → notice gone. Saving a draft un-confirms, so all results become Unknown. Drafts are not persisted, so a full refresh discards them (shown as no pending edits).

## Other fixes this round
- Expired / invalid deadlines show a timing notice that explicitly does not change eligibility.
- Apply/source links render only for absolute http(s) URLs.
- Manual entry rejects impossible dates; the same title+organization tracks the existing item instead of duplicating it.
- Opening an external link never changes status (no code path sets Submitted).

## Unresolved / known limitations
1. (Resolved) Template routing tests repaired.
2. Demo data only: opportunities fictional, matching rule-based, no verified sources, no CV upload, no AI.
3. Browser-local storage: no sync across devices; clearing site data erases it. The auth/DB plan is in `docs/AUTH_DB_PLAN.md` and needs approvals.
4. CSV import caps at 1 MB / 500 rows. Imported "submitted" statuses are accepted because they are user-provided data.
5. Mobile nav has 4 tabs. Add and Import/Export are reached from the header and from My Journey.
6. Full screen-reader audit (NVDA/VoiceOver) not yet performed.
