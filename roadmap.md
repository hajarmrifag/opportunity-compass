# Roadmap

## Exact Sourced homepage handoff
- [x] Replace src/routes/index.tsx with the supplied content verbatim
- [x] Supply missing motion exports and preserve the demo search parameter
- [x] Verify compilation and homepage navigation without restyling or teammate edits
- [x] Apply the supplied Sourced styles additively and preserve teammate styles
- [x] Add motion helpers and simple reduced-motion-aware atmosphere components
- [x] Update Sourced shell navigation and demo-search cinema mode
- [x] Verify the Sourced headline, lime uppercase button, demo-search cinema navigation, and mobile layout; build OK and no browser errors

- [x] Audit current files/contracts; preserve teammate changes
- [x] Profile edits invalidate confirmation; unknown never passes
- [x] Expiry distinct from eligibility; invalid deadlines/URLs handled
- [x] Keyboard/mobile audit
- [x] CSV tracker import/export (template, mapping, preview, validation, dupes, confirm, quoting, formula-injection guard)
- [x] docs/archive/TEAM_INTEGRATION.md
- [x] docs/QA_CHECKLIST.md
- [x] docs/DEMO_SCRIPT.md
- [x] docs/archive/AUTH_DB_PLAN.md (per-user RLS, provenance, migration/rollback, isolation tests, approvals) — plan only, no backend
- [x] Typecheck, unit tests, browser tests (core + mobile); final report
- [x] Fix off-by-one days-left (calendar-day diff in local tz, no hardcoded today); test it
- [x] Dashboard: deadline list window = 14-day count; record in QA
- [x] Fix 'useStore outside StoreProvider' blank screen (HMR context identity); verify reload + direct routes
- [x] Repair template routing tests' setup (no skip/weakening)
- [x] Unsaved Passport edits: label eligibility as based on last confirmed Passport
- [x] Full tests, typecheck, prod build; record in QA doc
- [x] Live web opportunity search (server-side, managed Firecrawl; inactive until connector approved): NL query + filters (category incl. jobs/masters, location/remote, subject, education, funding, deadline), source URL + retrievedAt, dedupe, open/closed/unknown, save-to-tracker, bounded/cached/rate-limited/cancellable, no demo fallback, no PII sent
- [x] Document exact connector/Cloud permissions + cost before activation (docs/LIVE_SEARCH.md)
- [x] Validate real search→source→save once connected (verified 3 Oct: approved Firecrawl connection already linked; real searches returned sourced listings and honest empty state)

## Live search

- [x] Server search + mapping + caching/rate limit/cancel
- [x] /search UI with filters, save to tracker
- [x] Tests (28 pass), build, docs/LIVE_SEARCH.md
- [x] Real search validation (connector linked 3 Oct)
- [x] Dashboard primary live search, demo excluded from counts

## Recommended page (approved plan)

- [x] recommended.ts: 5 categories, non-identifying profile hints, input schema
- [x] recommended.server.ts: per-category agent search, 6h cache, gemini-3.8-flash + gpt-6-astra fallback
- [x] /recommended page: explicit per-category buttons, cancel/retry, honest states, unverified labels
- [x] Nav: Recommended in sidebar + mobile nav
- [ ] Tests, typecheck, build, browser verification (needs Firecrawl reconnected for a real run)

## Hajar product experience

- [x] Premium responsive visual system and purposeful dashboard workspace
- [x] Guided live search with editable summary and active filter controls
- [x] Persistent three-item comparison shortlist, tray and comparison view
- [x] Persistent per-application action plans with explicit status isolation
- [x] Hajar feature ownership documentation
- [x] Regression, accessibility, mobile, browser, formatting, type and production checks

## Student profile creation

- [x] Expand Passport fields and migrate existing browser data without loss
- [x] Add validated PDF and pasted-text document intake
- [x] Add private AI extraction with evidence and honest per-file failures
- [x] Add conflict review, gap filling and separate confirmed/draft behavior
- [x] Add regression tests and verify upload-to-confirmation in browser

## Opportunity Atlas redesign

- [x] Replace the conservative shell with a compact icon rail and exhibition-style mobile navigation
- [x] Build the editorial Atlas dashboard with working search, category constellation, journey stages, actions and deadlines
- [x] Carry the visual system through search results, comparison, journey, opportunity detail and shared Passport shell
- [x] Verify desktop and 390px layouts, keyboard focus, zero page overflow, workflows, tests, types and production build

## Opportunity Atlas refinement

- [x] Remove the constellation and duplicate category chips; replace them with one aligned direction index
- [x] Rebalance the home workspace, calm the Passport prompt, and keep search plus next action visible immediately
- [x] Add visible navigation labels and refine shared typography, spacing, borders, cards and empty states
- [x] Align comparison facts and verify desktop, 390px mobile, keyboard workflows, formatting, tests, types and build
- [x] Final visual QA: complete desktop nav labels, restrained secondary headings, neutral Passport icon and broad category descriptions

## Opportunity Brief

- [x] Add one sourced Brief reached from live search, comparison and My Journey
- [x] Reuse the editable action plan without changing status behavior
- [x] Add typed local affordability scenarios and pure transparent calculations
- [x] Verify required numeric cases, existing regressions, desktop/mobile/keyboard and refresh persistence

- [x] Integrate finance handoff rules into Brief Affordability (re-verify after syncing Main)

## Account-backed Tracker (draft)

- [x] Staged additive migration: applications, application_events, coffee_chats, outreach_templates, resources, advice_log, user_roles + has_role, RLS + grants
- [x] Email sign-in page (/auth), protected layout, Tracker page (status dropdown, source, applied date, notes, keyword search), Resources page (shared curated list, admin-only edits); admin granted manually only; email_suggestions table staged
- [x] Save to Tracker button on listing cards (idempotent, sign-in prompt when logged out); bearer middleware in start.ts
- [x] Types, 44 tests, production build pass
- [ ] BLOCKED (main thread only): enable email sign-in; migration applies when draft is accepted — tracker cannot be exercised end-to-end in this draft

## Draft motion handoff

- [x] Merge six presentation source files; retain Tracker and all teammate contracts
- [x] Automatic build passed; 71 regressions and formatter passed; desktop/mobile shortcuts, Tracker, route/card motion and reduced motion verified
- [ ] Separate TypeScript invocation is unavailable under the managed validation workflow; live research visuals await a configured search service (no integration changes requested)

## Tracker career dashboard (approved 3 Oct)
- [x] Staged migration: 'assessment' status, coffee_chats.follow_up_date + outcome check, email_suggestions.kind
- [x] Summary cards, due-today panel, status chart, AI advice (resources-based, logged), coffee chat outcomes, suggestion review, status history
- [x] Gmail scan fn returns honest "not set up" until per-user Google registration exists
- [x] 71 tests pass, tsgo clean, build OK, browser check of /tracker (empty state) clean
- [ ] Full data test after draft acceptance (migration not applied in draft)
- [ ] AI feedback: clarify user's requested change

## Exact cinema replay import
- [x] Copy requested research and search source files from e7dd172
- [x] Add only replay fixtures and merge cinema/evidence styles
- [x] Verify recorded replay completion (6 pages, 3 kept, 3 rejected), stop control, source evidence, mobile layout, and homepage preservation; exact-file checks, 100 tests, and build passed

## Coffee chat referral + AI problem spotting (3 Oct)
- [x] Staged additive migration: coffee_chats.referral (yes/no flag); comments stay in existing notes column
- [x] Coffee chat form and rows: referral Yes/No select + editable comments; AI advice sees outcomes, referral counts and comments (bounded) to flag problems
- [x] Tests for advice chat summary; types, format, build re-checked

## Gmail inbox connection (3 Oct)
- [x] Registered user's Google OAuth client as Gmail App User Connector (linked to project, offline access on)
- [x] Staged migration 0006: app_user_connections (encrypted per-user connection keys, service-role only)
- [x] Connect/disconnect Gmail popup flow, OAuth return route, per-user status, Passport email match/mismatch warning
- [x] Real inbox scan: read-only Gmail search (60d, application keywords) → AI classifies → pending email_suggestions, dedupe by message id, never auto-applies
- [x] 101 tests, tsgo clean, build OK
- [ ] BLOCKED (draft acceptance): app_user_connections table does not exist until accepted — connecting Gmail saves the key only then; scan works after
- [ ] Outlook (microsoft_outlook) connector: awaiting user's Microsoft app credentials
