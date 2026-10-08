# Architecture

Sourced is a TanStack Start application with file-based routes. React components render the interface, server functions handle integrations, and shared contracts in `src/domain/types.ts` keep the two tracking flows and opportunity sources consistent.

## Opportunity flow

1. `src/data/fixtures.ts` supplies fictional Browse listings. The live Search route calls server-side search code in `src/lib/liveSearch*` and `src/lib/agentSearch*`.
2. Search mapping keeps source URLs, retrieval times, and unknown fields. Demo listings remain marked as demo data.
3. The eligibility adapter evaluates listed requirements against a confirmed Passport. Unknown requirements stay unknown; relevance is shown separately.
4. Users can compare, save, and plan around opportunities. Browser-local Journey state goes through `src/data/storage.ts` and `src/lib/store.tsx`.

## Account flow

Supabase handles sign-in and account-backed Tracker, coffee chat, and resource data. The relevant client and middleware live in `src/integrations/supabase/`; server functions live in `src/lib/tracker.functions.ts` and related modules. Schema changes live in `supabase/migrations/`.

My Journey and Tracker are separate experiences. A local save does not become an account record automatically.

## Integration boundaries

| Boundary | Location | Constraint |
| --- | --- | --- |
| Shared contracts | `src/domain/types.ts` | Keep opportunity, profile, funding, and application data explicit. |
| Demo data | `src/data/fixtures.ts` | Keep fictional listings clearly labelled with no real apply URL. |
| Browser storage | `src/data/storage.ts` | Use the repository interface for local persistence. |
| Live retrieval | `src/lib/liveSearch.server.ts`, `src/lib/agentSearch.server.ts` | Retrieve facts from pages on the server; do not invent missing values. |
| Profile extraction | `src/lib/profileExtraction.server.ts` | Require review before extracted values become the confirmed profile. |
| Account data | `src/integrations/supabase/`, `supabase/` | Keep service credentials on the server. |

See [AGENTS.md](../AGENTS.md) for the detailed project rules. `src/routeTree.gen.ts` is generated from route files and should not be edited manually.
