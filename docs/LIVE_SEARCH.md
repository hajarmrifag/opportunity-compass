# Live opportunity search — activation guide

Status: **active in this draft (3 Oct 2026).** The workspace's existing managed Firecrawl connection "Firecrawl" (gateway mode) is linked. No new connection was created and nothing was purchased. If the connection is unlinked, `/search` shows "Live search is not connected yet" and makes no network calls (no demo fallback).

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

## Cost — two separate kinds of credit
- **Firecrawl credits** are the search service's own usage units, counted per page it reads. A search with JSON extraction uses roughly 1 credit for the search plus about 5 credits per result page, so 8 results ≈ **40–50 Firecrawl credits per uncached search**. These are an estimate, not a quote; check Firecrawl's current pricing.
- **Lovable credits** are the workspace balance. On this *Lovable-managed* connection, the Firecrawl usage above is paid for by Lovable and charged to the workspace's Lovable credits; there is no separate Firecrawl invoice or Firecrawl account to top up. If the workspace runs out, searches return "out of credits" (402) or "credit limit reached" (403), and a workspace owner fixes that in Settings → Plans & credits (or raises the workspace credit limit). It is not fixed in Firecrawl.
- (Only if the team later switched to a "use your own credentials" Firecrawl connection would Firecrawl bill the team directly, from their own Firecrawl plan.)
- No AI model / AI Gateway call is made by search, so there is no separate AI charge.
- Cached repeats (10 min) cost nothing. Worst case at the rate limit: 6 searches/min per server instance.

## Validation after linking — DONE 3 Oct 2026 (see QA_CHECKLIST.md)
1. Open `/search`, query "paid summer software internship", category Internship → results show source domain + retrieval time.
2. Open a source link → confirm the title, deadline and funding match the page.
3. Save → check it appears in My Journey and its detail page shows "From live web · unverified".
4. Repeat the same query → "(cached)". Press Cancel mid-search → "Search cancelled".

## Rollback
Unlink the connector. The page then returns to "not connected". To remove the feature entirely, delete `src/routes/search.tsx`, the three `liveSearch*` files and the menu entry. Saved live items remain as ordinary tracker entries.
