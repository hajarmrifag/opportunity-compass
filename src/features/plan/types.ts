// Source – Application Plan (checklist + document help)
// Requirements come only from the official page (quote-verified), the team, or the student.

export type RequirementKind =
  | "online_application"
  | "cv"
  | "cover_letter"
  | "transcript"
  | "references"
  | "written_answers"
  | "online_test"
  | "video_interview"
  | "interview"
  | "portfolio"
  | "registration"
  | "other";

export type Stage = "application" | "assessment" | "interview" | "after_offer";

export type RequirementSource = "official_page" | "team" | "student_added";

export type ReviewStatus = "published" | "ai_extracted";

/** A due date can be fixed, or relative to a tracker event (e.g. 5 days after submitting). */
export interface DueRule {
  after: "submitted" | "invited" | "offer";
  days: number;
}

export interface Requirement {
  id: string;
  opportunityId: string;
  kind: RequirementKind;
  label: string;
  stage: Stage;
  required: boolean;
  dueDate: string | null; // ISO date
  dueRule: DueRule | null;
  evidenceQuote: string | null;
  sourceUrl: string | null;
  source: RequirementSource;
  status: ReviewStatus;
  note?: string | null;
}

/** Important rules from the official page that are not tasks (e.g. "withdrawing means you cannot reapply"). */
export interface Notice {
  id: string;
  opportunityId: string;
  text: string;
  evidenceQuote: string | null;
  sourceUrl: string | null;
}

export type ItemStatus = "not_started" | "in_progress" | "ready" | "submitted" | "not_needed";

export interface ProgressEntry {
  itemKey: string;
  status: ItemStatus;
  submittedAt?: string | null; // ISO date, set when status becomes submitted
  updatedAt?: string | null;
}

/** Mirrors the team tracker statuses. */
export type TrackerStatus =
  | "saved"
  | "preparing"
  | "submitted"
  | "assessment"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface TrackerState {
  status: TrackerStatus;
  submittedAt?: string | null;
  invitedAt?: string | null;
  offerAt?: string | null;
}

export interface OpportunityPlanRef {
  id: string;
  title: string;
  applicationDeadline: string | null;
  startDate: string | null;
  officialUrl?: string | null;
  /** Where the student continues the application (employer portal). Falls back to officialUrl. */
  applicationUrl?: string | null;
}

/** Steps generated from the money check (visa, funding, bookings). */
export interface MoneyStep {
  key: string; // e.g. "money:visa"
  label: string;
  stage: Stage;
  required: boolean;
  dueDate: string | null;
  note?: string | null;
  sourceUrl?: string | null;
}

export interface PlanInput {
  opportunity: OpportunityPlanRef;
  requirements: Requirement[];
  notices: Notice[];
  moneySteps: MoneyStep[];
  progress: ProgressEntry[];
  tracker: TrackerState;
  today: string; // ISO date, passed in so the function stays pure
}

export type ItemKind = RequirementKind | "money";

export interface PlanItem {
  key: string;
  label: string;
  kind: ItemKind;
  stage: Stage;
  required: boolean;
  locked: boolean;
  lockReason: string | null;
  status: ItemStatus;
  dueDate: string | null;
  dueLabel: string | null; // e.g. "Within 5 days of submitting"
  daysLeft: number | null;
  overdue: boolean;
  source: RequirementSource | "money_check";
  reviewStatus: ReviewStatus | null;
  evidenceQuote: string | null;
  sourceUrl: string | null;
  note: string | null;
  tool: "cv" | "cover_letter" | null;
}

export interface StageSummary {
  stage: Stage;
  locked: boolean;
  done: number;
  total: number;
}

export interface PlanResult {
  closed: boolean; // rejected or withdrawn
  items: PlanItem[];
  stages: StageSummary[];
  overall: { done: number; total: number };
  nextStep: PlanItem | null;
  documentTools: { cv: boolean; coverLetter: boolean };
  trackerHint: string;
  canMarkSubmitted: boolean;
  notices: Notice[];
}
