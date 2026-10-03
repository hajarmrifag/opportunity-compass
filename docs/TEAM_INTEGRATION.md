# OpportunityOS — Team Integration Guide

Status: frontend milestone 1. All data is **browser-local**. Opportunities are **fictional demo fixtures** (unverified). The eligibility engine is a **small deterministic demo adapter**, not AI. Nothing in this repo calls an external AI or a live data source.

## 1. File map (current, exact paths)

| Concern | Path | Owner / replaceable by |
|---|---|---|
| Typed contracts (single source of truth) | `src/domain/types.ts` | everyone, change only additively |
| Fictional fixtures (6 opps + demo profile "Maya") | `src/data/fixtures.ts` | Verified-data teammate replaces |
| Persistence (`Repository`, versioned localStorage) | `src/data/storage.ts` | Backend/auth teammate (see `docs/AUTH_DB_PLAN.md`) |
| Demo eligibility + relevance (`EligibilityAdapter`) | `src/adapters/demoEligibility.ts` | Matching teammate |
| App state / actions (`useStore`) | `src/lib/store.tsx` | SWE |
| Validators: dates, URLs, deadline timing, duplicate key | `src/lib/validation.ts` | SWE |
| CSV parser/serializer + formula guard | `src/lib/csv.ts` | SWE |
| Tracker CSV template/mapping/validation/export | `src/lib/trackerCsv.ts` | SWE |
| Pages | `src/routes/index.tsx` (Dashboard), `discover.tsx`, `opportunities.$id.tsx`, `journey.tsx`, `passport.tsx`, `add.tsx`, `tracker-io.tsx` | UI |
| Shared UI bits | `src/components/AppShell.tsx`, `OpportunityCard.tsx`, `ui-bits.tsx` | UI |
| Tests | `src/test/core.test.ts` | everyone |

## 2. Contracts (verbatim summary of `src/domain/types.ts`)

```ts
type DegreeLevel = "high_school" | "bachelor" | "master" | "phd" | "other";
type Category = "internship" | "scholarship" | "research" | "exchange" | "fellowship";

interface Profile {
  fullName: string; degreeLevel: DegreeLevel | null; field: string; graduationYear: number | null;
  skills: string[]; languages: string[];
  preferences: { categories: Category[]; locations: string[]; remoteOk: boolean };
  goals: string; fundingNeeds: { tuition: boolean; living: boolean; travel: boolean };
  confirmed: boolean; confirmedAt: string | null; source: "manual" | "demo" | "cv_parser";
}
interface ProfileExtractor { extract(file: File): Promise<Partial<Omit<Profile, "confirmed" | "confirmedAt">>>; }

type RequirementKind = "degreeLevel" | "field" | "graduationYear" | "skill" | "language" | "other";
interface Requirement { id: string; kind: RequirementKind; label: string; values?: string[]; min?: number; max?: number; }

type CoverageStatus = "covered" | "partial" | "not_covered" | "unknown";
interface CoverageItem { status: CoverageStatus; note?: string; }
interface FundingCoverage { tuition: CoverageItem; living: CoverageItem; travel: CoverageItem; paymentTiming: string | null; }

type Verification = "demo_unverified" | "user_entered" | "verified";
interface Opportunity {
  id: string; title: string; organization: string; category: Category; location: string;
  mode: "in_person" | "remote" | "hybrid" | "unknown"; summary: string;
  deadline: string | null;            // YYYY-MM-DD, date-only, local calendar day
  tags: string[]; requirements: Requirement[]; funding: FundingCoverage;
  sourceUrl: string | null; applyUrl: string | null; lastVerified: string | null;
  verification: Verification; isDemo: boolean;
}

type RequirementStatus = "met" | "not_met" | "unknown";
interface RequirementResult { requirement: Requirement; status: RequirementStatus; reason: string; }
interface EligibilityResult {
  opportunityId: string; overall: "meets_listed_criteria" | "not_eligible" | "incomplete";
  requirements: RequirementResult[]; relevance: { level: "high" | "medium" | "low"; reasons: string[] };
  basis: string;                      // e.g. "Based on demo criteria"
}
interface EligibilityAdapter { evaluate(profile: Profile | null, opportunity: Opportunity): EligibilityResult; }

type ApplicationStatus = "saved" | "preparing" | "submitted" | "interview" | "offer" | "rejected" | "withdrawn";
interface Application {
  id: string; opportunityId: string; status: ApplicationStatus; notes: string;
  deadline: string | null;            // user override, YYYY-MM-DD
  createdAt: string; updatedAt: string; history: { status: ApplicationStatus; at: string }[];
}
```

Persistence (`src/data/storage.ts`):
```ts
interface PersistedState { version: number; profile: Profile | null; applications: Application[]; customOpportunities: Opportunity[]; }
interface Repository { load(): { state: PersistedState; error: string | null }; save(s: PersistedState): string | null; clear(): void; }
// key "opportunityos", STORAGE_VERSION = 1. Unknown version or corrupt JSON -> fresh state + visible error banner.
```

## 3. Working JSON fixtures

Opportunity (copied from `src/data/fixtures.ts`, valid against the contract):
```json
{
  "id": "demo-coastal-research",
  "title": "Undergraduate Coastal Ecology Research Placement",
  "organization": "Tidewater Field Institute (fictional)",
  "category": "research", "location": "Remote + 2-week field visit", "mode": "hybrid",
  "summary": "Assist a fictional research group analysing coastal sensor data, with a short field component.",
  "deadline": "2026-10-12",
  "tags": ["biology", "environment", "research", "r", "data"],
  "requirements": [
    { "id": "r1", "kind": "degreeLevel", "label": "Bachelor's student", "values": ["bachelor"] },
    { "id": "r2", "kind": "field", "label": "Biology or environmental science", "values": ["biology", "environmental science"] },
    { "id": "r3", "kind": "skill", "label": "R or Python", "values": ["r", "python"] }
  ],
  "funding": {
    "tuition": { "status": "not_covered" },
    "living": { "status": "covered", "note": "Accommodation during field visit" },
    "travel": { "status": "covered", "note": "Field visit travel" },
    "paymentTiming": "Reimbursed after field visit"
  },
  "sourceUrl": null, "applyUrl": null, "lastVerified": null,
  "verification": "demo_unverified", "isDemo": true
}
```

Profile (draft as a CV parser should return it — **unconfirmed**):
```json
{
  "fullName": "Maya (fictional demo)", "degreeLevel": "bachelor", "field": "Computer Science",
  "graduationYear": 2027, "skills": ["Python", "SQL", "JavaScript"], "languages": ["English", "Spanish"],
  "preferences": { "categories": ["internship", "scholarship", "fellowship"], "locations": ["Europe"], "remoteOk": true },
  "goals": "Gain data and software experience, then pursue a funded master's.",
  "fundingNeeds": { "tuition": true, "living": true, "travel": false },
  "confirmed": false, "confirmedAt": null, "source": "cv_parser"
}
```

Application:
```json
{
  "id": "k3j2h1", "opportunityId": "demo-coastal-research", "status": "preparing",
  "notes": "Ask Dr. X for reference", "deadline": null,
  "createdAt": "2026-10-03T06:30:00.000Z", "updatedAt": "2026-10-03T06:35:00.000Z",
  "history": [{ "status": "saved", "at": "2026-10-03T06:30:00.000Z" }, { "status": "preparing", "at": "2026-10-03T06:35:00.000Z" }]
}
```

EligibilityResult for the opportunity above + confirmed Maya profile (actual output):
```json
{
  "opportunityId": "demo-coastal-research", "overall": "not_eligible",
  "requirements": [
    { "requirement": { "id": "r1", "kind": "degreeLevel", "label": "Bachelor's student", "values": ["bachelor"] }, "status": "met", "reason": "Passport: Bachelor's" },
    { "requirement": { "id": "r2", "kind": "field", "label": "Biology or environmental science", "values": ["biology", "environmental science"] }, "status": "not_met", "reason": "Passport: Computer Science" },
    { "requirement": { "id": "r3", "kind": "skill", "label": "R or Python", "values": ["r", "python"] }, "status": "met", "reason": "Passport lists Python" }
  ],
  "relevance": { "level": "medium", "reasons": ["Uses your skills: Python", "Covers a funding need you listed"] },
  "basis": "Based on demo criteria"
}
```

## 4. Plug-in points

**CV extraction** — implement `ProfileExtractor` in e.g. `src/adapters/cvExtractor.ts`. Return a partial draft with `source: "cv_parser"`. Feed it into the Passport form state (`src/routes/passport.tsx`, `setP(...)`), **never** call `saveProfile` with `confirmed: true`. The user must press "Confirm Passport". No upload UI exists yet; do not add a fake one.

**Eligibility / matching** — implement `EligibilityAdapter` in `src/adapters/<name>.ts` and swap the import in `src/routes/opportunities.$id.tsx` (only consumer). Must be synchronous today; if you need async, add an `evaluateAsync` method additively and we will update the page. Change `basis` to an honest label (e.g. "Based on provider-published criteria, verified <date>").

**Verified opportunities** — produce `Opportunity[]` with `verification: "verified"`, `isDemo: false`, real `sourceUrl`, `lastVerified` (ISO). Replace the `DEMO_OPPORTUNITIES` import in `src/lib/store.tsx` (`opportunities` memo) with your loader. Keep fixtures for tests/offline demo. `applyUrl` must be the provider's real URL or `null`; never synthesize one.

**Funding intelligence** — fill `Opportunity.funding`. Use `"unknown"` (and `paymentTiming: null`) whenever not explicitly sourced; put the evidence in `note`. UI already renders all four states and highlights the user's needs.

**Persistence / auth** — implement `Repository`; see `docs/AUTH_DB_PLAN.md`.

## 5. Compatibility rules

1. Contracts change **additively only** (new optional fields). Renames/removals need a `STORAGE_VERSION` bump and migration in `storage.ts`.
2. Missing information is `unknown`, never `met` / `covered`. Requirements of kind `other` are always `unknown` until a human or verified source confirms.
3. Eligibility and relevance are separate fields; never merge them into one score. No percentages, no acceptance probabilities.
4. Deadlines are date-only `YYYY-MM-DD`, interpreted as the local calendar day (`deadlineState` in `src/lib/validation.ts`). Expiry is timing, not eligibility.
5. URLs render only if `safeHttpUrl()` accepts them (absolute http/https).
6. No code path sets `status: "submitted"` except an explicit user action (status select or a user-provided CSV value).
7. Duplicate key for opportunities = normalized `title|organization` (`oppKey`). Saving is idempotent per `opportunityId`.
8. Fixtures keep `isDemo: true`, `verification: "demo_unverified"`, null `sourceUrl`/`applyUrl`/`lastVerified` (enforced by a test).
9. Run `bunx vitest run src/test/core.test.ts` before merging.

## Live search (verified-data / matching teammates)
- `src/lib/liveSearchMapping.ts` (pure): `liveSearchInput`, `buildQuery`, `EXTRACTION_SCHEMA`, `mapHit(hit, retrievedAt) → Opportunity | null`, `dedupe`, `applyFilters`.
- `src/lib/liveSearch.server.ts`: `runLiveSearch(input, signal?) → LiveSearchResponse`. To swap providers, replace this file and return the same contract.
- Live items use `verification: "web_retrieved"`, `isDemo: false`, `retrievedAt` set. A verified-data teammate may upgrade them to `"verified"` only after human review.
- See docs/LIVE_SEARCH.md for activation and cost.
