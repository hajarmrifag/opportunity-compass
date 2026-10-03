# 90-second demo script (honest version)

Say up front: "Everything you see uses **fictional demo data** stored in this browser. Matching is a small rule set labelled 'Based on demo criteria'. There is no live AI and no verified opportunity data yet; teammates are building those."

| Time | Do | Say |
|---|---|---|
| 0–10s | Open **Dashboard** (empty) | "Students start with an Opportunity Passport. Nothing is checked until they confirm it." |
| 10–25s | **Passport** → *Load demo profile* → point at "Not confirmed" → *Confirm Passport* | "Maya is fictional. Even pre-filled data needs the student's review. A CV parser would only fill this draft too." |
| 25–40s | **Discover** → filter *Fellowship*, search "python" | "Search and filters work, and the counts come from the data. Each card is marked Demo." |
| 40–60s | Open **Data Analytics Summer Internship** | "Eligibility and relevance are separate. Degree, Python and English are Met. Right to work in Portugal stays **Unknown**, because missing info never passes. Funding: tuition not covered, living partial, travel Unknown. No apply link, because we never invent one." |
| 60–75s | *Save to My Journey* (click twice) → **My Journey** → set *Submitted*, add a note, *Save notes* → refresh | "Saving is idempotent. Only the student marks Submitted, and it persists after refresh." |
| 75–90s | **Import / export CSV** → *Download template*; back to **Dashboard** | "Students can bring in a spreadsheet tracker, with a preview and confirmation. The dashboard shows real counts and the next 14 days of deadlines." |

Do **not** say: "AI matched", "verified", "you are eligible", "chance of acceptance".

## Fallbacks
- **Data in a weird state:** open DevTools → Application → Local Storage → delete key `opportunityos`, then refresh. Or use a private window.
- **Preview won't load:** present the screenshots in the QA checklist evidence, then walk through `docs/TEAM_INTEGRATION.md` §3 fixtures.
- **Fonts slow/offline:** the app falls back to system fonts. Everything still works offline once loaded, because there are no network calls.
- **Deadline numbers differ from slides:** the countdown is relative to today's date on the demo machine. That's expected.
