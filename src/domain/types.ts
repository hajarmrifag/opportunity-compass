// Shared data contracts. Teammates integrate by producing/consuming these shapes.

export type DegreeLevel = "high_school" | "bachelor" | "master" | "phd" | "other";
export const DEGREE_LABELS: Record<DegreeLevel, string> = {
  high_school: "High school",
  bachelor: "Bachelor's",
  master: "Master's",
  phd: "PhD",
  other: "Other",
};

export type Category = "internship" | "scholarship" | "research" | "exchange" | "fellowship";
export const CATEGORY_LABELS: Record<Category, string> = {
  internship: "Internship",
  scholarship: "Scholarship",
  research: "Research",
  exchange: "Exchange",
  fellowship: "Fellowship",
};

export interface Profile {
  fullName: string;
  degreeLevel: DegreeLevel | null;
  field: string;
  graduationYear: number | null;
  skills: string[];
  languages: string[];
  preferences: { categories: Category[]; locations: string[]; remoteOk: boolean };
  goals: string;
  fundingNeeds: { tuition: boolean; living: boolean; travel: boolean };
  confirmed: boolean;
  confirmedAt: string | null;
  source: "manual" | "demo" | "cv_parser";
}

/** Integration point: CV parser returns a DRAFT; the user must still review + confirm. */
export interface ProfileExtractor {
  extract(file: File): Promise<Partial<Omit<Profile, "confirmed" | "confirmedAt">>>;
}

export type RequirementKind = "degreeLevel" | "field" | "graduationYear" | "skill" | "language" | "other";
export interface Requirement {
  id: string;
  kind: RequirementKind;
  label: string;
  values?: string[];
  min?: number;
  max?: number;
}

export type CoverageStatus = "covered" | "partial" | "not_covered" | "unknown";
export interface CoverageItem {
  status: CoverageStatus;
  note?: string;
}
export interface FundingCoverage {
  tuition: CoverageItem;
  living: CoverageItem;
  travel: CoverageItem;
  paymentTiming: string | null; // null = unknown
}

export type Verification = "demo_unverified" | "user_entered" | "verified";

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  category: Category;
  location: string;
  mode: "in_person" | "remote" | "hybrid" | "unknown";
  summary: string;
  deadline: string | null; // ISO date
  tags: string[];
  requirements: Requirement[];
  funding: FundingCoverage;
  sourceUrl: string | null;
  applyUrl: string | null;
  lastVerified: string | null;
  verification: Verification;
  isDemo: boolean;
}

export type RequirementStatus = "met" | "not_met" | "unknown";
export interface RequirementResult {
  requirement: Requirement;
  status: RequirementStatus;
  reason: string;
}
export interface EligibilityResult {
  opportunityId: string;
  overall: "meets_listed_criteria" | "not_eligible" | "incomplete";
  requirements: RequirementResult[];
  relevance: { level: "high" | "medium" | "low"; reasons: string[] };
  basis: string; // e.g. "Based on demo criteria"
}

/** Integration point: real matching engine implements this. */
export interface EligibilityAdapter {
  evaluate(profile: Profile | null, opportunity: Opportunity): EligibilityResult;
}

export type ApplicationStatus =
  | "saved" | "preparing" | "submitted" | "interview" | "offer" | "rejected" | "withdrawn";
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  preparing: "Preparing",
  submitted: "Submitted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export interface Application {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  notes: string;
  deadline: string | null; // user override
  createdAt: string;
  updatedAt: string;
  history: { status: ApplicationStatus; at: string }[];
}
