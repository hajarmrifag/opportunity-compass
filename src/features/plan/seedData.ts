// Requirements and rules taken from BlackRock's official page (checked 2026-10-03).
// Quotes are copied exactly so they can be shown as evidence. Mirrors supabase/migrations/004_plan_seed.sql.
import type { Notice, OpportunityPlanRef, Requirement } from "./types";

/** Replace with the BlackRock opportunity id from your opportunities table. */
export const BLACKROCK_ID = "blackrock-spring-insight-emea-2027";
const URL = "https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752";

export const BLACKROCK_PLAN: OpportunityPlanRef = {
  id: BLACKROCK_ID,
  title: "BlackRock 2027 Spring Insight Event – EMEA",
  applicationDeadline: "2026-12-04", // check on the official page; applications may close early
  startDate: "2027-04-01", // approximate: "April 2027"
  officialUrl: URL,
};

export const BLACKROCK_REQUIREMENTS: Requirement[] = [
  {
    id: "br-online-application",
    opportunityId: BLACKROCK_ID,
    kind: "online_application",
    label: "Submit the online application (one programme, up to two functions)",
    stage: "application",
    required: true,
    dueDate: null, // inherits the application deadline
    dueRule: null,
    evidenceQuote: "Candidates can apply for only one programme",
    sourceUrl: URL,
    source: "official_page",
    status: "published",
    note: "Applications may close before the deadline, so apply early.",
  },
  {
    id: "br-pre-interview-assessment",
    opportunityId: BLACKROCK_ID,
    kind: "online_test",
    label: "Complete the pre-interview assessment",
    stage: "assessment",
    required: true,
    dueDate: null,
    dueRule: { after: "submitted", days: 5 },
    evidenceQuote: "You have up to five days to submit your pre-interview assessment",
    sourceUrl: URL,
    source: "official_page",
    status: "published",
    note: "The invitation arrives by email after you submit.",
  },
];

export const BLACKROCK_NOTICES: Notice[] = [
  {
    id: "br-notice-withdraw",
    opportunityId: BLACKROCK_ID,
    text: "If you withdraw, you cannot apply to this programme again this year.",
    evidenceQuote: "If you withdraw your application, you cannot submit another application for this programme this year.",
    sourceUrl: URL,
  },
  {
    id: "br-notice-assessment",
    opportunityId: BLACKROCK_ID,
    text: "Missing the 5-day assessment window withdraws your application automatically.",
    evidenceQuote: "if you fail to do so, your application will be automatically withdrawn",
    sourceUrl: URL,
  },
  {
    id: "br-notice-same-application",
    opportunityId: BLACKROCK_ID,
    text: "Apply for both functions in the same application.",
    evidenceQuote: "You must apply for both opportunities using the same programme application.",
    sourceUrl: URL,
  },
];
