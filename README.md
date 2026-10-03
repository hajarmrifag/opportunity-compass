# Opportunity Compass

Build OpportunityOS: a working student opportunity discovery and application tracker. Create Dashboard, Discover, opportunity detail, editable Opportunity Passport and My Journey. Use a warm off-white/navy/teal accessible responsive design. Functional manual profile confirmation, search and category filters, idempotent save, editable application statuses and notes with browser-local persistence across refresh. Use 6 clearly labelled fictional Demo opportunities across internships, scholarships, research and fellowships. Derive all counts from data. Separate eligibility met/not met/unknown from relevance; missing criteria never pass. Show transparent funding coverage and unknowns. No fabricated acceptance scores, real program facts, source URLs or live AI claims. Modular typed Profile, Opportunity, EligibilityResult, FundingCoverage and Application contracts; separate fixtures, storage and demo matching adapter so four teammates can integrate CV parsing, real matching, verified data and funding intelligence. User explicitly sets Submitted, never automatically on Apply. Include manual opportunity entry and empty/error states. Do not activate cloud, paid integrations or public deployment. Build and validate the first functional frontend milestone.Build OpportunityOS: a polished, responsive opportunity discovery and application tracker for global students. Build the software engineer's first product/integration milestone for our five-person hackathon team.
Core journey: manually create and confirm Passport -> Discover -> opportunity details with transparent eligibility and funding -> Save -> update application status, persisted across refresh.
Pages: Dashboard, Discover, opportunity detail, My Journey, editable Passport. Warm off-white, navy typography, teal accents, accessible focus states, desktop sidebar/mobile navigation. Functional product, not marketing landing page.
Use 6 FICTIONAL opportunities across internships, scholarships, research, exchanges and fellowships, visibly marked Demo data. Optional Load demo profile for fictional Maya. Counts derived from data. No fake real programs, source links, live AI claims or acceptance probabilities.
Passport fields: degree level, field, graduation year, skills, languages, preferences, goals and funding needs. User review/confirmation is required. Manual input works; leave typed integration interface for teammate's future CV parser, no fake upload.
Discover supports search/category/funding filters, empty states, idempotent save. Details separate relevance from eligibility; requirements have met/not met/unknown and missing information never passes. Small deterministic demo adapter clearly labelled Based on demo criteria. Do not claim guaranteed eligibility or display application-strength percentages.
Funding coverage: tuition, living, travel, payment timing with explicit Unknown. Data contract includes sourceUrl and lastVerified, but fictional data must honestly state unverified/demo. Never invent an Apply URL.
Tracker statuses: Saved, Preparing, Submitted, Interview, Offer, Rejected, Withdrawn. Editable status, notes, optional deadline. Saving twice never duplicates. Clicking external Apply never auto-marks Submitted. Manual opportunity entry supports those found elsewhere. Dashboard shows actual saved items and approaching deadlines.
Use local browser persistence for this first foundation, with versioned storage and typed Profile, Opportunity, EligibilityResult, FundingCoverage, Application contracts. Separate fixtures, repositories, demo eligibility adapter and UI for teammates to replace. Do not enable cloud, external AI, paid integrations or public deployment yet. Include validation, error/empty/loading states. Verify end-to-end flow and refresh persistence. Report working features, demo limitations and integration points. Real AI and verified data are later teammate integrations.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b5b21fbc-1f71-4379-aa3c-6f813f3fab5d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
