// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
// Runtime self-check for the application plan, reminders and CV studio (mirrors the unit tests), shown on /plan-tests.

export interface CheckResult {
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
}
import { buildPlan } from "./buildPlan";
import { checkSuggestion, splitCv } from "./cvGuard";
import { BLACKROCK_ID, BLACKROCK_NOTICES, BLACKROCK_PLAN, BLACKROCK_REQUIREMENTS } from "./seedData";
import type { PlanInput, Requirement } from "./types";
import { applicationStatus, remindersFor } from "./reminders";
import { buildFromAnswers, checkChange, factsFromCv } from "../cv/cvModel";

const cvReq: Requirement = {
  id: "student-cv", opportunityId: BLACKROCK_ID, kind: "cv", label: "Upload CV", stage: "application", required: true,
  dueDate: null, dueRule: null, evidenceQuote: null, sourceUrl: null, source: "student_added", status: "published",
};
const clReq: Requirement = { ...cvReq, id: "student-cl", kind: "cover_letter", label: "Cover letter" };

const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  opportunity: BLACKROCK_PLAN,
  requirements: [...BLACKROCK_REQUIREMENTS, cvReq, clReq],
  notices: BLACKROCK_NOTICES,
  moneySteps: [],
  progress: [],
  tracker: { status: "preparing" },
  today: "2026-10-03",
  ...o,
});

export function runPlanSelfChecks(): CheckResult[] {
  const out: CheckResult[] = [];
  const add = (name: string, expected: string, actual: string) => out.push({ name, expected, actual, pass: expected === actual });

  const p1 = buildPlan(input({ progress: [{ itemKey: "req:student-cv", status: "submitted" }] }));
  add("P1 CV submitted, cover letter not started", "1 of 3 application steps done", p1.trackerHint);
  add("P1b cannot mark submitted yet", "false", String(p1.canMarkSubmitted));

  const s1 = buildPlan(input());
  add("S1 assessment locked while preparing", "true", String(s1.items.find((i) => i.key === "req:br-pre-interview-assessment")?.locked));

  const s2 = buildPlan(input({ tracker: { status: "submitted", submittedAt: "2026-11-20" }, today: "2026-11-22" }));
  const t = s2.items.find((i) => i.key === "req:br-pre-interview-assessment");
  add("S2 assessment due 5 days after submitting", "2026-11-25, 3 days left", `${t?.dueDate}, ${t?.daysLeft} days left`);

  add("D1 document tools when CV and letter are required", "cv, cover letter", [s1.documentTools.cv && "cv", s1.documentTools.coverLetter && "cover letter"].filter(Boolean).join(", "));
  const d2 = buildPlan(input({ requirements: BLACKROCK_REQUIREMENTS }));
  add("D2 no tools when no documents are required", "none", d2.documentTools.cv || d2.documentTools.coverLetter ? "shown" : "none");

  const cv = splitCv("Tutored 12 students in English\nMember of the investment society");
  add("G2 added number rejected", "rejected", checkSuggestion(cv, { lineId: "L1", suggested: "Tutored 12 students, raising scores by 30%" }).rejected ? "rejected" : "accepted");
  add("G3 new tool needs confirmation", "needs confirmation",
    checkSuggestion(cv, { lineId: "L2", suggested: "Member of the investment society, modelling in Bloomberg" }).needsConfirmation ? "needs confirmation" : "accepted");

  const visa = { key: "money:visa", label: "Apply for UK ETA", stage: "after_offer" as const, required: true, dueDate: "2027-03-11" };
  add("M1 extra step locked until an offer", "true", String(buildPlan(input({ moneySteps: [visa] })).items.find((i) => i.key === "money:visa")?.locked));

  // Reminders: CV submitted, cover letter not, 5 days before the deadline
  const partial = buildPlan(input({ progress: [{ itemKey: "req:student-cv", status: "submitted" }], today: "2026-11-29" }));
  const clReminder = remindersFor(partial, BLACKROCK_PLAN).find((r) => r.itemLabel === "Cover letter");
  add("R2 reminder for the missing cover letter", "Cover letter: due in 5 days", clReminder?.message ?? "none");
  const banner = applicationStatus(partial);
  add("R3 banner shows the deadline", "true", String(!!banner?.detail?.includes("closes in 5 days (4 Dec 2026)")));

  // CV studio: facts-only checks
  const built = buildFromAnswers({
    name: "Demo Student", education: [], activities: [], projects: [],
    experience: [{ title: "English Tutor", organisation: "Self-employed", description: "Tutored 12 students in English" }],
  });
  const bullet = built.sections[0].entries[0].bullets[0];
  const facts = factsFromCv(built, "student");
  add("C3 invented number removed", "rejected",
    checkChange(built, facts, "", { kind: "edit_bullet", bulletId: bullet.id, newText: "Tutored 12 students, raising grades by 25%" }).rejected ? "rejected" : "allowed");
  add("C4 unknown tool needs confirmation", "needs confirmation",
    checkChange(built, facts, "", { kind: "add_bullet", entryId: built.sections[0].entries[0].id, newText: "Built models in Bloomberg" }).needsConfirmation ? "needs confirmation" : "allowed");

  return out;
}
