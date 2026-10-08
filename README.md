# Sourced

**Hong Kong AI Summit: BUILD ACROSS Hackathon · Startup Track · 3–4 October 2026**

**Find student opportunities, understand the evidence, and keep applications moving.**

Sourced was built for the **Startup Track** of the **Hong Kong AI Summit: BUILD ACROSS Hackathon**. It helps students search for internships, scholarships, research placements, fellowships, and other opportunities. It combines source-linked web search with a reviewed student profile, transparent eligibility and funding details, and two ways to track applications: a browser-local Journey and an account-backed Tracker.

The repository was developed as **Opportunity Compass / OpportunityOS**. The product is branded **Sourced** in the app.

## Hackathon context

| | |
| --- | --- |
| Event | [Hong Kong AI Summit: BUILD ACROSS Hackathon](https://www.startmeup.hk/events-detail/hong-kong-ai-summit-build-across-hackathon/) |
| Track | **Startup Track** |
| Date | 3–4 October 2026 |
| Project | Sourced, a student opportunity discovery and application platform |

The hackathon prototype focuses on a practical student journey: build a Passport, find opportunities with visible sources and unknowns, compare options, and track next steps.

## What you can do

| Area | Current behavior |
| --- | --- |
| Search | Search live pages through a connected Firecrawl service. Results retain their source URL and retrieval time; unstated details remain unknown. A bounded research mode can help plan and review searches. |
| Browse | Explore clearly marked fictional demo opportunities without a live connection. |
| Passport | Enter a profile manually or review suggested details from uploaded documents before confirming them. |
| Compare and plan | Compare saved opportunities, inspect listed criteria and funding, and build an application plan. |
| My Journey | Save opportunities, edit statuses and notes, and import or export CSV data in this browser. |
| Tracker | Sign in to manage account-backed applications, coffee chats, follow-ups, and resources. |

Eligibility is an interpretation of *listed* requirements, not an admission decision. Missing criteria remain unknown. Demo opportunities are fictional; web results need verification at their linked source before applying.

## Run locally

Use Node.js and npm. The project also includes `bun.lock` for Bun users.

```bash
git clone https://github.com/hajarmrifag/opportunity-compass.git
cd opportunity-compass
npm install
npm run dev
```

Open the URL printed by Vite. The checked-in `.env` contains the public Supabase project URL and publishable key used by this project. For a different Supabase project, replace those public values and apply the SQL migrations in `supabase/migrations/` to that project. Never put a service role key or provider secret in a `VITE_` variable.

The browser-local Journey and fictional Browse data are useful for a first look. Account-backed Tracker features need a configured Supabase project. Live search, document extraction, and AI features also depend on server-side credentials or managed connectors; their availability is shown in the app. See [live search setup](docs/LIVE_SEARCH.md) for the search integration.

```bash
npm run build     # production build
npm test          # Vitest suite
npm run lint      # ESLint and Prettier rules
```

## Repository map

| Path | Purpose |
| --- | --- |
| `src/routes/` | TanStack Start file-based pages and route layouts |
| `src/components/` | Shared interface components |
| `src/features/` | CV, application plan, and affordability features |
| `src/domain/` | Shared TypeScript contracts |
| `src/data/` | Demo fixtures and browser storage |
| `src/adapters/` | Eligibility and matching boundaries |
| `src/lib/` | Search, profile, tracker, finance, and other application logic |
| `src/integrations/` | Supabase and managed connector clients |
| `src/server.ts`, `src/lib/*.server.ts` | Server entry and server-only logic |
| `src/test/` | Vitest tests |
| `supabase/` | Database migrations and edge functions |
| `docs/` | Current guides and an `archive/` for early plans; start with the [docs index](docs/README.md) |

TanStack Start generates `src/routeTree.gen.ts`; edit route files, not the generated tree. Shared data shapes live in `src/domain/types.ts`. The project’s [architecture rules](AGENTS.md) describe the boundaries that protect demo data, user consent, and source integrity.

For a short explanation of how data moves through the app, see [Architecture](docs/ARCHITECTURE.md).

## Data and limitations

- **My Journey** stores data in browser storage. Clearing site data or switching browsers removes access to that local data unless you exported it.
- **Tracker** uses Supabase authentication and database tables. It is separate from My Journey; signing in does not migrate browser-local items.
- **Live search** retrieves pages through Firecrawl. A retrieved page is source-linked, but its facts can be stale or incomplete. Search requires the managed connection and credits.
- **Gmail** is not connected in this branch. The Tracker reports that scanning is unavailable and does not change application statuses.
- **Demo opportunities** are fictional and labelled as such. They have no real apply links.

## Project notes

This is a hackathon build that continues to evolve. The [roadmap](roadmap.md) and [QA checklist](docs/QA_CHECKLIST.md) record implementation history and known issues; some older milestone notes describe the earlier browser-only prototype. The app was built with [Lovable](https://lovable.dev), and the connected [Lovable project](https://lovable.dev/projects/b5b21fbc-1f71-4379-aa3c-6f813f3fab5d) can be used for further development.
