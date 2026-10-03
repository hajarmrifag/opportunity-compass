import type {
  DocumentExtractionResult,
  ExtractionCandidate,
  FieldEvidence,
  Profile,
  ProfileValueSource,
  WorkExperienceEntry,
} from "@/domain/types";
import { DEGREE_LABELS, type DegreeLevel } from "@/domain/types";

const experienceKey = (item: WorkExperienceEntry) =>
  `${item.role.trim().toLowerCase()}|${item.organization.trim().toLowerCase()}`;

/** Keeps every existing (incl. student-typed) entry; adds extracted roles not already present. */
export function mergeExperiences(
  existing: WorkExperienceEntry[],
  incoming: WorkExperienceEntry[],
): WorkExperienceEntry[] {
  const seen = new Set(existing.map(experienceKey));
  const merged = [...existing];
  for (const item of incoming) {
    const key = experienceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/** New finds become suggestions only; anything already in the profile or already suggested is skipped. */
export function suggestExperiences(
  accepted: WorkExperienceEntry[],
  pending: WorkExperienceEntry[],
  incoming: WorkExperienceEntry[],
): WorkExperienceEntry[] {
  const taken = new Set(accepted.map(experienceKey));
  return mergeExperiences(pending, incoming).filter((item) => !taken.has(experienceKey(item)));
}

/** Student approves a suggestion: it moves into the profile (once) and leaves the suggestion list. */
export function acceptExperience(profile: Profile, id: string): Profile {
  const item = profile.experienceSuggestions.find((entry) => entry.id === id);
  if (!item) return profile;
  return {
    ...profile,
    workExperience: mergeExperiences(profile.workExperience, [item]),
    experienceSuggestions: profile.experienceSuggestions.filter((entry) => entry.id !== id),
  };
}

export function dismissExperience(profile: Profile, id: string): Profile {
  return {
    ...profile,
    experienceSuggestions: profile.experienceSuggestions.filter((entry) => entry.id !== id),
  };
}

/** Only http(s) public links; returns a normalised URL or null. */
export function normalizeWebSourceUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname))
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function webSourceLabel(url: string): "linkedin" | "github" | "website" {
  const host = new URL(url).hostname.toLowerCase();
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host.endsWith("github.com")) return "github";
  return "website";
}

export const EXTRACTABLE_FIELDS = [
  "fullName",
  "email",
  "degreeLevel",
  "degreeName",
  "school",
  "field",
  "gpaValue",
  "gpaScale",
  "graduationDate",
  "graduationDatePrecision",
  "skill",
  "language",
  "languageLevel",
] as const;

export const fieldLabel = (field: string) =>
  ({
    fullName: "Name",
    email: "Email",
    degreeLevel: "Degree level",
    degreeName: "Degree",
    school: "School",
    field: "Field of study",
    gpaValue: "GPA value",
    gpaScale: "GPA scale",
    graduationDate: "Graduation date",
    graduationDatePrecision: "Graduation date precision",
    skill: "Skill",
    language: "Language",
    languageLevel: "Language level",
  })[field] ?? field;

export interface ExtractionConflict {
  field: string;
  candidates: ExtractionCandidate[];
}

/**
 * A conflict is only when DIFFERENT documents disagree on a field. One CV listing two schools
 * (e.g. a main degree and an exchange) is several education records, not a conflict; the first
 * value per document is that document's main answer.
 */
export function extractionConflicts(results: DocumentExtractionResult[]): ExtractionConflict[] {
  const grouped = new Map<string, ExtractionCandidate[]>();
  const list = Array.isArray(results) ? results : [];
  for (const result of list) {
    const seen = new Set<string>();
    for (const candidate of Array.isArray(result?.candidates) ? result.candidates : []) {
      if (candidate.field === "skill" || candidate.field === "language") continue;
      if (seen.has(candidate.field)) continue;
      seen.add(candidate.field);
      grouped.set(candidate.field, [...(grouped.get(candidate.field) ?? []), candidate]);
    }
  }
  return [...grouped.entries()]
    .filter(
      ([, candidates]) =>
        new Set(candidates.map((item) => item.value.trim().toLowerCase())).size > 1,
    )
    .map(([field, candidates]) => ({ field, candidates }));
}

const educationKey = (item: { school: string; degreeName: string }) =>
  `${item.school.trim().toLowerCase()}|${item.degreeName.trim().toLowerCase()}`;

const degreeFrom = (value: string): DegreeLevel | null => {
  const normalized = value.toLowerCase();
  return (
    (Object.keys(DEGREE_LABELS) as DegreeLevel[]).find(
      (key) => key === normalized || DEGREE_LABELS[key].toLowerCase() === normalized,
    ) ?? null
  );
};

export function applyExtractedCandidates(
  base: Profile,
  results: DocumentExtractionResult[],
  choices: Record<string, string> = {},
): Profile {
  const candidates = (Array.isArray(results) ? results : []).flatMap((result) =>
    Array.isArray(result?.candidates) ? result.candidates : [],
  );
  const byField = new Map<string, ExtractionCandidate[]>();
  for (const candidate of candidates) {
    byField.set(candidate.field, [...(byField.get(candidate.field) ?? []), candidate]);
  }
  const conflicts = new Set(extractionConflicts(results).map((item) => item.field));
  const selected = (field: string) => {
    const options = byField.get(field) ?? [];
    if (choices[field]) return options.find((item) => item.value === choices[field]);
    return conflicts.has(field) ? undefined : options[0];
  };
  const firstEducation = base.education[0] ?? {
    id: `education-${Date.now()}`,
    degreeLevel: null,
    degreeName: "",
    school: "",
    field: "",
  };
  const evidence: FieldEvidence[] = [];
  const provenance: Record<string, ProfileValueSource> = { ...base.fieldProvenance };
  const value = (field: string, current: string) => {
    const candidate = selected(field);
    if (!candidate) return current;
    evidence.push({ ...candidate });
    provenance[field] = "extracted";
    return candidate.value;
  };
  const degree = selected("degreeLevel");
  if (degree) {
    evidence.push({ ...degree });
    provenance["degreeLevel"] = "extracted";
  }
  const skills = [
    ...new Set([...base.skills, ...(byField.get("skill") ?? []).map((item) => item.value)]),
  ];
  const languages = [
    ...new Set([...base.languages, ...(byField.get("language") ?? []).map((item) => item.value)]),
  ];
  const primary = {
    ...firstEducation,
    degreeLevel: degree ? degreeFrom(degree.value) : firstEducation.degreeLevel,
    degreeName: value("degreeName", firstEducation.degreeName),
    school: value("school", firstEducation.school),
    field: value("field", firstEducation.field),
  };
  const educationList = [primary, ...base.education.slice(1)];
  const taken = new Set(educationList.map(educationKey));
  const takenSchools = new Set(
    educationList.map((item) => item.school.trim().toLowerCase()).filter(Boolean),
  );
  for (const result of Array.isArray(results) ? results : []) {
    for (const item of Array.isArray(result?.education) ? result.education : []) {
      const school = item.school.trim().toLowerCase();
      if (taken.has(educationKey(item)) || (school && takenSchools.has(school))) continue;
      taken.add(educationKey(item));
      if (school) takenSchools.add(school);
      educationList.push({ ...item });
    }
  }
  return {
    ...base,
    fullName: value("fullName", base.fullName),
    email: value("email", base.email ?? "").trim().toLowerCase(),
    degreeLevel: degree ? degreeFrom(degree.value) : base.degreeLevel,
    field: value("field", base.field),
    education: educationList,
    gpaValue: value("gpaValue", base.gpaValue),
    gpaScale: value("gpaScale", base.gpaScale),
    graduationDate: value("graduationDate", base.graduationDate ?? "") || null,
    graduationDatePrecision:
      (value(
        "graduationDatePrecision",
        base.graduationDatePrecision ?? "",
      ) as Profile["graduationDatePrecision"]) || null,
    graduationYear:
      Number(value("graduationDate", base.graduationDate ?? "").match(/\b(19|20)\d{2}\b/)?.[0]) ||
      base.graduationYear,
    skills,
    languages,
    languageDetails: languages.map((name) => ({
      name,
      level: base.languageDetails.find((item) => item.name === name)?.level ?? "",
    })),
    fieldProvenance: provenance,
    fieldEvidence: [
      ...base.fieldEvidence.filter((item) => !evidence.some((next) => next.field === item.field)),
      ...evidence,
    ],
    workExperience: base.workExperience ?? [],
    experienceSuggestions: suggestExperiences(
      base.workExperience ?? [],
      base.experienceSuggestions ?? [],
      (Array.isArray(results) ? results : []).flatMap((result) => result?.experiences ?? []),
    ),
    sourceDocuments: (Array.isArray(results) ? results : []).map((result) => result.document),
    source: "cv_parser",
    confirmed: false,
    confirmedAt: null,
  };
}

export function canConfirmProfile(profile: Profile, unresolvedConflictCount: number) {
  const hasEducation = profile.education.some(
    (item) => item.degreeName.trim() || item.school.trim(),
  );
  if (!hasEducation) return { ok: false, reason: "Add at least one degree or school." };
  if (profile.gpaValue.trim() && !profile.gpaScale.trim()) {
    return { ok: false, reason: "Add the GPA scale or remove the GPA value." };
  }
  if (!normalizeEmail(profile.email) && !profile.emailTrackingOptOut) {
    return {
      ok: false,
      reason: profile.email?.trim()
        ? "That email doesn't look right — check it, or tick that you don't need email tracking."
        : "Email missing — add your email, or tick that you don't need email tracking.",
    };
  }
  if (unresolvedConflictCount > 0) {
    return { ok: false, reason: "Resolve every document conflict before making the profile." };
  }
  return { ok: true, reason: "" };
}

// Strict enough to catch typos: one @, no spaces, no leading/trailing/consecutive
// dots, and a domain ending in a dot + at least two letters.
const EMAIL_RE =
  /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
/** Normalised Passport email, or "" when missing/invalid. */
export function normalizeEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}
/** Compare the Passport email with a connected inbox address. */
export function emailMatchState(
  passportEmail: string | null | undefined,
  inboxEmail: string | null | undefined,
): "missing" | "not_connected" | "match" | "mismatch" {
  const a = normalizeEmail(passportEmail);
  if (!a) return "missing";
  const b = normalizeEmail(inboxEmail);
  if (!b) return "not_connected";
  return a === b ? "match" : "mismatch";
}
