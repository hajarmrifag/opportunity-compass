# Live opportunity search — activation guide

Status: **code built, NOT activated.** No connector is linked and nothing has been purchased. Until a Firecrawl connection is linked, `/search` shows "Live search is not connected yet". It makes no network calls and shows no demo or fallback results.

## What it does
1. The user enters a natural-language query and filters: category (internship, fellowship, master's, job, …), location or remote, subject, education level, funded only, and deadline on or after.
2. The server function `liveSearch` (`src/lib/liveSearch.functions.ts`) runs one Firecrawl `/v2/search` call with `scrapeOptions.formats: [{type:"json", schema, prompt}]`. Firecrawl reads each result page and extracts fields **from that page's text only**. Anything the page doesn't state comes back as null.
3. `src/lib/liveSearchMapping.ts` maps each hit to `Opportunity` and keeps its original `sourceUrl` and `retrievedAt`. It sets `verification: "web_retrieved"` and `isDemo: false`. The apply URL is kept only when it's on the same site as the source. Invalid dates become null. Funding that isn't stated is marked "unknown". Results are deduplicated by normalized URL and by title + organisation, then filtered. Unknown values never satisfy a filter.
4. Open/closed/unknown status comes from the stated deadline via `deadlineState`. Eligibility uses the existing adapter, and unknown requirements never pass.
5. Save adds the listing to the user's own browser storage and marks it Saved. Submitted is only ever set by the user.

No language model generates listings from memory. If the search returns nothing, the UI says so.

## Limits and safeguards
| Control | Value |
|---|---|
| Query length | 2–200 chars, zod-validated on server |
| Results per search | 8 pages |
| Cache | identical query+filters, 10 min, in-memory per server instance |
| Rate limit | 6 searches / 60 s per server instance (best-effort, not global) |
| Cancel | Cancel button aborts the request; server forwards abort to Firecrawl |
| Errors | not connected, out of credits (402), busy (429), re-link needed (401/403), network |
| Privacy | only the search form fields are sent. Never name, email, Passport, CV or notes (covered by a unit test) |
| Secrets | `FIRECRAWL_API_KEY` / `LOVABLE_API_KEY` are read only on the server. The production build was checked: neither appears in the browser bundle |

## Approvals needed before activation
1. **Link the Firecrawl connector** (Lovable-managed, gateway mode) to this project. This adds the server secret `FIRECRAWL_API_KEY` (a `lovc_…` connection key). A workspace admin approves this in Connectors.
2. **Lovable Cloud is NOT required.** Search runs in the app's existing server functions, and saved items stay in browser storage. Cloud is needed later only for accounts and a shared database (see AUTH_DB_PLAN.md).
3. No Perplexity or AI model is used, so there's no AI Gateway spend for search.

## Cost
- Firecrawl charges per page read. Search with JSON extraction costs roughly **1 credit per search plus about 5 credits per result page with JSON extraction**. With 8 results that's about **40–50 credits per uncached search**. Check the current Firecrawl pricing page before activating, because rates change.
- Managed-connector usage is billed to the workspace's Lovable credits. Cached repeats cost nothing.
- Worst case at the rate limit: 6 searches/min per instance. Lower the limit or result count in `liveSearch.server.ts` if needed.

## Validation after linking (not yet done, blocked on connector)
1. Open `/search`, query "paid summer software internship", category Internship → results show source domain + retrieval time.
2. Open a source link → confirm the title, deadline and funding match the page.
3. Save → check it appears in My Journey and its detail page shows "From live web · unverified".
4. Repeat the same query → "(cached)". Press Cancel mid-search → "Search cancelled".

## Rollback
Unlink the connector. The page then returns to "not connected". To remove the feature entirely, delete `src/routes/search.tsx`, the three `liveSearch*` files and the menu entry. Saved live items remain as ordinary tracker entries.
