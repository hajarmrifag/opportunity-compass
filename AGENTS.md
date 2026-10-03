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
- Application status changes are user-initiated only; no code path may set "submitted" automatically.
