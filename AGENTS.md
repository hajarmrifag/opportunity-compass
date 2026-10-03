<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# OpportunityOS architecture rules

- All shared data shapes live in `src/domain/types.ts`; integrations must produce/consume these contracts so teammates can swap parts independently.
- Fictional fixtures live only in `src/data/fixtures.ts` and must keep `isDemo: true`, `verification: "demo_unverified"`, and null source/apply URLs — prevents fake facts leaking as real.
- Persistence goes through the `Repository` interface in `src/data/storage.ts` (versioned localStorage now) — lets a remote backend replace it without UI changes.
- Eligibility/relevance is computed only via an `EligibilityAdapter` (`src/adapters/`); missing data must yield "unknown", never "met" — honesty requirement.
- App state is accessed via `useStore()` in `src/lib/store.tsx`, hydrated from storage in an effect — avoids SSR hydration mismatch.
- Application status changes are user-initiated, except: pressing Apply on a live listing (`markApplied`) moves an item to Submitted, and a confident Gmail email matching exactly one tracked application moves it forward (`scanGmailInbox`); neither ever downgrades or changes final states (offer, rejected, withdrawn).
- Date-only deadlines are compared as local calendar days via `deadlineState` in `src/lib/validation.ts`; `DEADLINE_WINDOW_DAYS` is the single "approaching" window — keeps UI counts consistent.
- URLs render only through `safeHttpUrl`; CSV output goes through `src/lib/csv.ts` (`escapeCell`) for quoting and formula-injection protection.
- CSV import applies only after preview + explicit confirm, as one atomic `importTracker` commit — prevents partial or surprise writes.
- Live search runs only server-side via `src/lib/liveSearch.server.ts`; listings come from retrieved page text (`verification: "web_retrieved"`), never model memory, with no demo fallback — honesty + no client secrets.
- Comparison IDs and application tasks persist additively in the versioned repository; task completion never changes application status — preserves records and explicit user control.
- Profile documents are processed transiently by the server and never persisted; only reviewed values, source labels, filenames, and short evidence snippets may be saved — limits exposure of sensitive student documents.
- A profile review draft is stored separately from the last confirmed profile; extraction and edits never replace the profile used for matching until the student presses Make profile — preserves explicit consent.

- Opportunity Atlas presentation changes stay within shared shell, route markup, presentational components, and global styles; Passport behavior and all data/integration boundaries remain untouched — protects concurrent profile extraction work.
- The research agent (`src/lib/agentSearch*.ts`) may only propose queries and keep/reject rule-extracted candidates; facts come from Firecrawl page extraction, all model output is schema-validated and bounded (3 queries/8 pages/1 refinement) — model cannot invent listings.
- Affordability scenarios are user-owned browser-local assumptions calculated only by the pure `calculateAffordability` seam; they never overwrite sourced funding facts or application status — keeps finance review modular and honest.
- The finance teammate's pure calculator lives in `src/features/calculator/` (no DB access); `reviewedData.ts` feeds it only reviewed, non-demo rows and otherwise the Brief uses the local `calculateAffordability` — eligibility never counts as an award.

- Shared motion uses scoped CSS and the cmdk CommandCenter in AppShell; research trails render only returned agent stages — keeps presentation independent of teammate data contracts.
- Shared animation easing is exported from src/lib/motion.ts for motion/react components — keeps animation timing consistent without altering supplied components.
- Cinema replay uses the deterministic researchReplay driver and researchTrail event contract with invented fixtures only — keeps recorded demonstrations independent of live retrieval and teammate modules.
- Campaign atmosphere is isolated in the shell's presentation-only AmbientField and VibeCursor and disabled for reduced motion — protects teammate behavior and accessibility.

- Tracker Insights shows only the AI feedback button — no status charts; account-backed queries still refresh through foreground polling every 15 seconds, and status changes stay user-initiated.

- Coffee chat history lives on its own `/coffee-chats` page sharing `CoffeeChatRow`; the Tracker keeps the add form and Insights. Email results are shown passively (no manual scan button) with a last-updated time.
