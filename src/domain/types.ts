// Shared data contracts. Teammates integrate by producing/consuming these shapes.

export type DegreeLevel = "high_school" | "bachelor" | "master" | "phd" | "other";
export const DEGREE_LABELS: Record<DegreeLevel, string> = {
  high_school: "High school",
  bachelor: "Bachelor's",
  master: "Master's",
  phd: "PhD",
  other: "Other",
};

export type Category =
  "internship" | "scholarship" | "research" | "exchange" | "fellowship" | "job" | "masters";
export const CATEGORY_LABELS: Record<Category, string> = {
  internship: "Internship",
  scholarship: "Scholarship",
  research: "Research",
  exchange: "Exchange",
  fellowship: "Fellowship",
  job: "Job",
  masters: "Master's programme",
};

/** Uploaded papers use cv/transcript/other; student-owned web links use the web labels. */
export type DocumentLabel = "cv" | "transcript" | "other" | "linkedin" | "website" | "github" | "web";
export type GraduationDatePrecision = "day" | "month" | "year";
export type ProfileValueSource = "extracted" | "manual";

export type WorkType = "internship" | "part_time" | "full_time" | "volunteer" | "research" | "other";
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  internship: "Internship",
  part_time: "Part-time",
  full_time: "Full-time",
  volunteer: "Volunteer",
  research: "Research",
  other: "Other",
};

export interface WorkExperienceEntry {
  id: string;
  role: string;
  organization: string;
  type: WorkType | null;
  location: string;
  description: string;
  /** Source filename/URL when extracted; empty when the student typed it. */
  sourceFile: string;
  snippet: string;
  /** Papers, posters, projects or impact explicitly written in the source or typed by the student. */
  outputs: string[];
  /** What the student has done so far / progress, in their own or the source's words. */
  progress: string;
}

export interface EducationEntry {
  id: string;
  degreeLevel: DegreeLevel | null;
  degreeName: string;
  school: string;
  field: string;
}

export interface LanguageEntry {
  name: string;
  level: string;
}

export interface SourceDocument {
  name: string;
  label: DocumentLabel;
}

export interface FieldEvidence {
  field: string;
  value: string;
  sourceFile: string;
  snippet: string;
}

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
  education: EducationEntry[];
  gpaValue: string;
  gpaScale: string;
  graduationDate: string | null;
  graduationDatePrecision: GraduationDatePrecision | null;
  languageDetails: LanguageEntry[];
  constraints: string[];
  fieldProvenance: Record<string, ProfileValueSource>;
  sourceDocuments: SourceDocument[];
  fieldEvidence: FieldEvidence[];
  workExperience: WorkExperienceEntry[];
  /** Roles found in documents/links awaiting the student's approval; never used for matching. */
  experienceSuggestions: WorkExperienceEntry[];
}

/** Integration point: CV parser returns a DRAFT; the user must still review + confirm. */
export interface ProfileExtractor {
  extract(input: DocumentExtractionInput): Promise<DocumentExtractionResult>;
}

export interface DocumentExtractionInput {
  name: string;
  label: DocumentLabel;
  mimeType: "application/pdf" | "text/plain";
  content: string;
}

export type ExtractableProfileField =
  | "fullName"
  | "degreeLevel"
  | "degreeName"
  | "school"
  | "field"
  | "gpaValue"
  | "gpaScale"
  | "graduationDate"
  | "graduationDatePrecision"
  | "skill"
  | "language"
  | "languageLevel";

export interface ExtractionCandidate {
  field: ExtractableProfileField;
  value: string;
  sourceFile: string;
  snippet: string;
}

export interface DocumentExtractionResult {
  ok: boolean;
  document: SourceDocument;
  candidates: ExtractionCandidate[];
  /** Work/volunteer/research roles explicitly written in the source. */
  experiences?: WorkExperienceEntry[];
  warnings: string[];
  error: string | null;
}

export type RequirementKind =
  "degreeLevel" | "field" | "graduationYear" | "skill" | "language" | "other";
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

/** web_retrieved = extracted from the live source page at retrievedAt; NOT human-verified. */
export type Verification = "demo_unverified" | "user_entered" | "web_retrieved" | "verified";

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
  /** ISO timestamp when the source page was fetched (live search only). */
  retrievedAt?: string | null;
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
  "saved" | "preparing" | "submitted" | "interview" | "offer" | "rejected" | "withdrawn";
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
  tasks: ActionTask[];
}

export interface ActionTask {
  id: string;
  label: string;
  completed: boolean;
  dueDate: string | null;
  suggested: boolean;
  createdAt: string;
}
