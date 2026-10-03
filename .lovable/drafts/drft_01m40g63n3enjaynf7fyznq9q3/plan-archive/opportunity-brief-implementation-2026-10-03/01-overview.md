# Opportunity Brief implementation

## Outcome

Add one editorial **Opportunity Brief** page for every live-search or saved opportunity. It will consolidate sourced facts, retrieval details, transparent eligibility/relevance, save and compare controls, the existing editable action plan, and a locally persisted affordability workspace.

## Build scope

- Add direct **View brief** navigation from live results, saved cards, comparison, and My Journey.
- Preserve the current detail URL and make it the complete Brief, so saved links remain valid.
- Extract the existing action-plan editor into a shared presentation component used by the Brief and My Journey without changing task/status rules.
- Add typed finance contracts, a pure calculator, and additive versioned browser persistence per opportunity.
- Build editable cost and support rows with currency, period, component, timing, source/evidence status, confirmed-versus-conditional support, and waiver-versus-cash distinctions.
- Show base case, separate “If awarded” scenario, known subtotal, explicit Unknown totals, upfront cash need, eventual gap, and readable arithmetic.
- Never convert currencies/periods, treat missing costs as zero, duplicate a waiver deduction, infer verification, or change application status.
- Add focused numeric and behavior tests, then verify desktop, mobile, keyboard, refresh persistence, and the existing search/save/compare/journey flow.

## Boundaries

No Cloud, schema, authentication, connectors, publishing, Passport extraction, matching logic, or research-agent backend changes. Demo records remain fictional and labelled.
