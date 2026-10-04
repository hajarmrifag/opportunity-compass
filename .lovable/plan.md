# Connect the Application plan to the real app

Nothing inside the plan or CV features changes, and the plan tables stay as they are. Gmail sync, the tracker logic and sign-in also stay as they are. /plan-demo and /plan-tests are not touched.

## Pages that change

1. **Opportunity Brief** (`/opportunities/$id`, the page you reach from Search, Browse, My Journey and the Tracker) shows the full Application plan for saved items, placed under the current Action plan.
2. **Tracker** (`/tracker`): each application card gets one small plan summary line.
3. **App header**: a reminder bell appears in the desktop sidebar and the mobile top bar.
4. **Home** (`/`): a "Due soon" list appears below the main area. The cinema homepage stays as it is.

## Two trackers, one rule

The app keeps saved items in two places:
- **Account Tracker**: signed-in, in the database, and updated by Gmail.
- **My Journey**: kept in the browser only.

The plan follows the **Account Tracker record when one exists** for that opportunity, matched by the opportunity's ID. Otherwise it uses the My Journey record. This way Gmail changes reach the plan, because the Tracker already refreshes every 15 seconds.

## Mapping opportunity fields

| Plan field | Our field |
|---|---|
| id | opportunity id (same as the Tracker's listing id) |
| title | title (on Tracker cards with no stored opportunity: "company — role") |
| applicationDeadline | the student's own deadline override if set, else the listed deadline |
| startDate | null (we don't store one) |
| officialUrl | sourceUrl, checked to be a safe web link |
| applicationUrl | applyUrl, checked to be a safe web link |
| description | summary |

## Mapping tracker statuses

| Our status | Plan status |
|---|---|
| saved, preparing, submitted, assessment, interview, offer, rejected, withdrawn | same name |
| (none) | `accepted` is never produced. We have no Accepted status, so we won't invent one |

Dates come from the status history (Account Tracker events, or My Journey history):
- **submittedAt**: the Tracker's applied date if set, else the first "submitted" event.
- **invitedAt**: the first "assessment" or "interview" event.
- **offerAt**: the first "offer" event.

Anything missing stays null.

## Mark as submitted

- **Account Tracker record:** call the existing "set status to Submitted" action, then refresh the Tracker data.
- **My Journey record only:** call the existing My Journey status update to Submitted.

Either way the student confirms it first, through the plan's own button.

## Reminders (bell and Due soon)

The bell and the Due soon list get the student's saved items:
- **Signed in:** Account Tracker applications, each paired with its opportunity details where stored (otherwise "company — role", with no deadline).
- **Otherwise:** My Journey items.

Clicking a reminder opens that opportunity's Brief.

## Technical details

- New `src/lib/planBridge.ts`: pure mappers `toPlanOpportunity`, `toPlanTracker(app, events)`, and `useSavedPlans()`. The hook reuses the existing tracker queries (same query keys and the same 15-second polling) when signed in.
- Edited: `src/routes/opportunities.$id.tsx`, `src/routes/_authenticated/tracker.tsx` (TrackerRow markup only), `src/components/AppShell.tsx`, `src/routes/index.tsx`.
- No schema changes and no server function changes.
