# Hajar product experience verification — 3 Oct 2026

- 42 automated tests pass, including v1→v2 non-destructive migration, comparison identity/limit, guided-search mapping, cancellation and timeout regressions.
- Type check and production build pass; preview build is healthy.
- Real Firecrawl search completed from the dashboard using an explicit query and goal selection; no page or unhandled-rejection errors occurred.
- Browser journey verified: labelled demo comparison (2 items) → save → general and custom tasks → completion → refresh persistence; application status remained `saved` throughout.
- Comparison shows demo provenance, source unavailable, Needs verification, Not stated and Unknown rather than invented facts.
- 390×844 mobile dashboard and first-tab Skip to content keyboard focus verified visually and interactively.
- Browser run used a fresh context and a clearly labelled `TEST — email mentor` task; no real Passport was loaded or changed.

# Opportunity Brief verification — 3 Oct 2026

- The Brief opens from listing cards and retains explicit demo/unverified provenance, unknown values, separate eligibility, and sourced funding facts.
- A saved item exposes the shared action plan; four general suggestions were added without changing its `Saved` application status.
- A clearly labelled private scenario (`TEST tuition` HKD 80,000 and confirmed waiver HKD 60,000) calculated an HKD 20,000 gap and survived refresh.
- Seven finance unit cases pass: equal coverage, multi-cost subtotal/gap, later reimbursement/upfront need, unknown required cost, conditional award, capped duplicate waivers, and incompatible currency/period groups.
- Browser checks passed at 1280×1800 and 390×844 with no horizontal overflow, first-Tab focus, no page errors, and no status inference.
- Full regression suite: 61 tests passed; TypeScript and production build passed. Main, Lovable Cloud, connections, and real Passport data were untouched.

# Student profile creation verification — 3 Oct 2026

- A clearly labelled fictional pasted CV completed the real server-side extraction path. It extracted Test University, Bachelor of Science, Computer Science, 2027, Python, SQL and English, with source snippets beside the corresponding fields.
- The test profile remained separate until “Make profile”; confirmation was enabled only after the education requirement was met, then the confirmed profile survived a full refresh. No page errors occurred.
- Automated regressions cover cross-document GPA conflicts, explicit conflict selection, and the rule that a GPA value cannot be confirmed without its scale. Full suite: 44 passed; type check clean.
- Files are validated before extraction, processed privately, and are not stored. Per-file errors preserve successful results and manual entry remains available.
- Remaining limitations: scanned PDFs are not OCR'd; automatic extraction depends on available workspace AI credits; data still stays only in this browser, so multi-user row isolation awaits the planned backend handoff.

# QA checklist — milestone 1 (draft, 3 Oct 2026)

Environments: dev preview, Chromium (Playwright) at 1280×1800 and 390×844, timezone Asia/Hong_Kong. Unit tests are also run with TZ = Asia/Hong_Kong, America/Los_Angeles, UTC, Pacific/Kiritimati.

## Automated

| Check                                                                                                                                                                                                                                                                                                                                      | Result            | Evidence                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsgo --noEmit`)                                                                                                                                                                                                                                                                                                               | PASS              | no output                                                                                                                                                                                                                                                                                                                                                                          |
| `src/test/core.test.ts` (16 tests: CSV quoting/BOM/CRLF/unterminated quote, formula neutralization, date + URL validation, calendar-day countdown incl. DST, expiry≠eligibility, unconfirmed/missing → unknown, `other` stays unknown, profile edit recomputes, fixture honesty, CSV alias mapping, dedupe/actions, export/template parse) | PASS in all 4 TZs | `TZ=… bunx vitest run src/test/core.test.ts` → 16 passed                                                                                                                                                                                                                                                                                                                           |
| `src/test/app-routing.test.tsx` (template test)                                                                                                                                                                                                                                                                                            | PASS (repaired)   | Was failing because the root `shellComponent` renders `<html>` and the test mounted it inside a `<div>` before any route match existed. Fix: the test now resolves the router first (`await router.load()`, as SSR does) and mounts into `document`. No tests skipped. Assertions kept, plus stronger ones: `<main>` exists on `/`, and "Page not found" shows on an unknown path. |

## Final gate run (06:4x UTC, 3 Oct 2026)

```
$ tsgo --noEmit            -> exit 0, no output
$ bunx vitest run          -> Test Files 2 passed (2); Tests 18 passed (18)
                              (core.test.ts 16, app-routing.test.tsx 2)
$ bun run build            -> exit 0 ("✓ built" for all 3 bundles; no errors)
```

Known harmless test-only warning: React logs `href=""` for the stylesheet link, because Vite's `?url` import resolves to an empty string under vitest.

## Browser (Playwright, scripted)

| Flow                                                                                                                                                                                                           | Result       | Evidence                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Confirm with empty Passport blocked, field errors shown                                                                                                                                                        | PASS         | 4 field errors (milestone run)                                                                    |
| Demo profile loads **unconfirmed**; explicit confirm required                                                                                                                                                  | PASS         | "Not confirmed" chip present                                                                      |
| Editing a confirmed Passport shows "Unsaved edits — confirm again"; Save draft un-confirms                                                                                                                     | PASS         | chip present; status → Not confirmed                                                              |
| Eligibility recomputes after edit (field → Biology makes Coastal Research "Meets all listed demo criteria")                                                                                                    | PASS         | text found                                                                                        |
| Countdown: 3 Oct (HKT) → 20 Oct shows **17 days left**                                                                                                                                                         | PASS (fixed) | detail header text                                                                                |
| Save twice → one tracker item                                                                                                                                                                                  | PASS         | 1 item                                                                                            |
| Status Submitted + note persist after refresh                                                                                                                                                                  | PASS         | select = submitted; note kept                                                                     |
| CSV import: quoted comma title, in-file duplicate skipped, already-tracked skipped, invalid row (bad category, 2026-02-31, `javascript:` URL, missing title) rejected; explicit confirm; persists after reload | PASS         | preview "1 new · 0 track · 0 update · 2 skip · 1 with errors"; journey shows 2 items after reload |
| CSV export neutralizes formulas and quotes commas                                                                                                                                                              | PASS         | `"'=HYPERLINK(""x"")"`, `"Lisbon, Portugal"`                                                      |
| Keyboard: first Tab focuses "Skip to content"; visible focus ring                                                                                                                                              | PASS         | activeElement text                                                                                |
| Mobile 390px: bottom nav, no horizontal overflow                                                                                                                                                               | PASS         | `scrollWidth > innerWidth` = false; screenshot                                                    |
| No runtime page errors                                                                                                                                                                                         | PASS         | errors: []                                                                                        |

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

## Live search (code built, connector not linked)

| Check                                              | Command / method          | Result                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type check                                         | `tsgo --noEmit`           | exit 0                                                                                                                                                                         |
| Full tests                                         | `bunx vitest run`         | **28 passed** (core 16, liveSearch 10, app-routing 2)                                                                                                                          |
| Production build                                   | `bun run build`           | exit 0; no `FIRECRAWL_API_KEY`/gateway URL in `dist/client`                                                                                                                    |
| `/search` not connected (desktop 1280, mobile 390) | Playwright                | banner shown, Search disabled, 0 demo results, 0 browser→Firecrawl requests, no overflow, no page errors                                                                       |
| Mapping honesty                                    | unit tests                | source URL + retrievedAt kept; off-site apply URL dropped; unstated funding = unknown; invalid date = null; unknown requirement never passes; filters exclude unknowns; dedupe |
| Server                                             | unit tests (mocked fetch) | not configured → no network call; cache; 402 surfaced; rate limit after 6                                                                                                      |
| **Unresolved**                                     | —                         | Real search → source → save NOT validated: needs Firecrawl connector approval                                                                                                  |

## Live search — real-search validation (3 Oct 2026, ~07:20 UTC, connector "Firecrawl" linked, gateway mode)

Fix found during validation: the extraction prompt treated official single-programme master's pages as "not a listing", so a master's search returned 0. The prompt now counts one official programme/job/fellowship/scholarship page as a listing and excludes directories, forums, Q&A and social posts. Re-run: UChicago and UC Irvine MSc pages extracted as `masters`, Quora/Facebook dropped.

Server-side runs (`runLiveSearch`, real Firecrawl):

| Query (category)                                         | Time   | Results / dropped                                                                                                                                          | Example sources (original URLs)                                                                                                                              |
| -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| software engineering summer internship 2027 (Internship) | 7.2 s  | 3 / 5                                                                                                                                                      | careers.twosigma.com/…Summer-2027/14016; careers.jnj.com/…/r-095602/… (deadline 2026-08-24); job-boards.greenhouse.io/pdtpartners/jobs/8077685               |
| climate policy fellowship (Fellowship)                   | 8.1 s  | 3 / 5                                                                                                                                                      | cpo.noaa.gov/fellowships/; climatehq.sfsu.edu/…lej-climate-action-fellowship; climatesolutionsfoundation.com/csffellows (deadline 2026-04-15 → shown Closed) |
| MSc data science scholarship (Master's)                  | 8.5 s  | 0 / 8 before fix → after fix: datascience.uchicago.edu/…/ms-in-applied-data-science/, mds.ics.uci.edu/admissions/, msdatascience.as.miami.edu/admissions/… |
| graduate analyst job (Job)                               | 13.5 s | 3 / 5                                                                                                                                                      | goldmansachs.com/careers/students/…/new-analyst-programme; analysisgroup.com/careers/…/analyst/; ziprecruiter.com/…                                          |

Browser end-to-end (Playwright, 1280 px, real search):

| Step                                                                                                | Result                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Dashboard "Find real opportunities" → query → navigates to `/search?q=…` and runs                   | PASS — "6 listings · retrieved 10/3/2026 7:19:31 AM · 2 pages skipped"                          |
| First result source                                                                                 | jpmorganchase.com/careers/explore-opportunities/programs/software-engineer-summer → HTTP 200    |
| Eligibility & funding panel                                                                         | requirements all "Unknown" (Passport not confirmed); funding all Unknown (page didn't state it) |
| Save to My Journey → "✓ Saved" → Open details shows "From live web · unverified" + same source link | PASS                                                                                            |
| Refresh My Journey → item still present                                                             | PASS                                                                                            |
| Dashboard "Saved from live search" = 1; demo items excluded from counts                             | PASS                                                                                            |
| Page errors                                                                                         | none                                                                                            |

Gates after these changes: `tsgo --noEmit` exit 0 · `bunx vitest run` → 3 files, **28 passed** · `bun run build` exit 0 · no `lovc_`/gateway string in `dist/client`.

Known limitations: extraction quality depends on each page (some fields "unknown"; scholarship _guide_ pages can still be classified as listings — they are labelled unverified and filtered out when a category is selected); rate limit/cache are per server instance; job-board mirrors (Indeed/ZipRecruiter) may appear as sources.

## Fix: aggregate / multi-listing pages (independent HK test, 3 Oct 2026 ~07:30 UTC)

**Found (team):** query "software engineering internships Hong Kong" returned `intrack.hk/internships/stem` as one Hang Seng listing with a mismatched Summer Associate summary, and `hk.indeed.com/q-software-intern-jobs.html` as a Goldman Sachs listing. Citadel's official page was correct, and saving created exactly one tracker item.
**Cause:** the extractor was asked for "the single opportunity on this page", so on board/category pages it stitched facts from different entries into one.
**Fix (`src/lib/liveSearchMapping.ts`):**

1. `isAggregateUrl` rejects search-query parameters (`q`, `keywords`, …), search/category paths (`/q-…-jobs.html`, `-jobs`, `/search`, `/results`, trailing `/jobs`, `/internships`, …), and job-board/aggregator hosts (Indeed, LinkedIn, ZipRecruiter, JobsDB, intrack.hk, …) unless the URL is a specific detail page (`/viewjob`, `/jobs/view/<id>`, `/job/<slug>`, numeric job ids).
2. The extractor now must return `page_type`. Only `single_opportunity_detail` is accepted; `listings_on_page > 1` is rejected. The prompt forbids combining fields from different entries.
3. The rules run after extraction, so a confident single-listing answer from the model can't override them. Rejected pages are counted as "skipped". The app does not yet follow links from board pages to fetch the original detail page; such pages are dropped instead.

**Regression tests (`src/test/liveSearch.test.ts`, 5 new):** the observed intrack.hk and Indeed URLs with the stitched Hang Seng / Goldman content → rejected; 6 other search/category URL patterns → rejected; model-flagged multi-listing / missing page_type → rejected; job-board detail pages, Citadel, Greenhouse and NOAA → kept; UChicago and UC Irvine master's programme pages → kept as `masters`.

**Results:**

```
$ tsgo --noEmit      -> exit 0
$ bunx vitest run    -> 3 files, 33 passed (core 16, liveSearch 15, app-routing 2)
$ bun run build      -> exit 0
```

**Live re-run (real Firecrawl):** "software engineering internships Hong Kong" → 2 listings, 6 skipped: citadelsecurities.com/careers/details/software-engineer-intern-asia/ and janestreet.com/join-jane-street/position/8617298002/. No intrack.hk or Indeed result. "MSc data science scholarship" (Master's) → UChicago, UC Irvine and Miami programme pages kept.
**Trade-off:** fewer results, because board pages are skipped rather than resolved. A detail-URL resolver (follow the board link, then extract the detail page) is a possible later step and would cost extra Firecrawl credits.

## Evidence — live search abort/timeout fix (3 Oct 2026, 07:32 UTC)

- Fixed: AbortError thrown from `liveSearch.server.ts` fetch after Cancel/navigation. The server now returns a typed result `cancelled` (user abort) or `timeout` (upstream exceeded `UPSTREAM_TIMEOUT_MS`, 55 s) and no longer throws. Aborts while reading the response body are handled the same way. Cancelled and timed-out results are never cached.
- Page: results from a stale or unmounted search are ignored, and loading always clears. Cancelled shows "Search again"; errors (including timeout) show "Retry".
- My Journey empty state now links to Live search.
- `bunx vitest run`: 3 files, 39 tests passed. New tests cover user cancel, already-aborted request (no provider call), navigating away mid-search followed by a successful uncached search with no unhandled rejection, upstream timeout followed by success, abort during body read, and that a plain network failure stays a `provider_error`.
- `tsgo --noEmit`: clean. `bun run build`: success.
- Not done: live provider search (needs the connector; no new connections were made). No publishing.

## Evidence — Firecrawl link verified + real live search on main (3 Oct 2026, 07:35 UTC)

- The existing approved Firecrawl connection (created by Hajar, managed, gateway-backed) was already linked to this project; no new connection was created and nothing was purchased. `FIRECRAWL_API_KEY` and `LOVABLE_API_KEY` are present in the server runtime.
- End-to-end browser run on `/search` (Playwright, real provider):
  - `liveSearchStatus` returned `configured: true`.
  - "undergraduate computer science scholarship 2026" → searched the live web, read 8 pages, all 8 honestly skipped as non-listings, empty state shown ("No matching listings found… We don't fill gaps with made-up results."). No page errors.
  - "computer science scholarship" → real listings returned, e.g. a $2,500 mathematics/ML scholarship and the Mary E. and Elmer H. Dohrmann Scholarship, each with source (scholarships360.org), retrieved-at time, "From live web · unverified" badge, and a Save to My Journey button. No page errors, no unhandled rejections.
- Formatting: `prettier --write` applied only to files changed by the abort/timeout repair (search.tsx, liveSearch.server.ts, liveSearchMapping.ts, liveSearch.functions.ts, journey.tsx, liveSearch.test.ts); `prettier --check` now passes on all of them. No other files touched.
- Re-run after formatting: `bunx vitest run` 3 files, 39 tests passed; `tsgo --noEmit` clean; `bun run build` success.
- No publishing, no new connections.

## Passport five-step wizard — 3 Oct 2026
- Rebuilt /passport as a guided wizard: Upload sources → Extract details → Review information → Fill gaps → Confirm profile, with progress indicator, Back/Continue, auto-saved draft, "Saved" status, sticky action bar, and a success screen after creation.
- Step 1: drag-and-drop up to 3 PDFs (5 MB each) with rename/remove/label per file, paste-text panel, collapsed web-link option with consent-gated Read link (verified disabled until URL valid + consent ticked).
- Step 2: rotating status messages during extraction, then an honest summary of what was found/missing; unreadable documents reported plainly ("1 document could not be read").
- Step 3: review cards by topic with Edit-only controls, "Not provided" for gaps, and "From your document" / "Added by you" labels; document conflicts resolved with explicit choices.
- Step 4: gap questions with why-it-helps notes, searchable multi-selects (curated lists + free text), category chips, structured graduation date, add-language rows, add-education flow, conditional follow-ups (remote hides locations; funding reveals tuition/living/travel; Master's shows preferred field).
- Step 5: read-only profile preview with Edit links back to steps, "Create my profile" + "Save and finish later"; confirmation blocked with a clear reason when education is missing (verified).
- Browser-verified: full manual journey (review → gaps → confirm → create) succeeds; after refresh the wizard resumes at Review with saved data visible; mobile viewport renders with bottom nav; no page errors.
- Checks: tsgo clean, 45/45 tests pass, prettier applied to changed files, build OK.
- Note: AI document reading could not be exercised in this run (no AI available); the failure path is handled and shown honestly.
