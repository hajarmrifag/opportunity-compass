import type {
  DocumentExtractionResult,
  ExtractionCandidate,
  FieldEvidence,
  Profile,
  ProfileValueSource,
} from "@/domain/types";
import { DEGREE_LABELS, type DegreeLevel } from "@/domain/types";

export const EXTRACTABLE_FIELDS = [
  "fullName",
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

export function extractionConflicts(results: DocumentExtractionResult[]): ExtractionConflict[] {
  const grouped = new Map<string, ExtractionCandidate[]>();
  for (const candidate of results.flatMap((result) => result.candidates)) {
    if (candidate.field === "skill" || candidate.field === "language") continue;
    grouped.set(candidate.field, [...(grouped.get(candidate.field) ?? []), candidate]);
  }
  return [...grouped.entries()]
    .filter(
      ([, candidates]) =>
        new Set(candidates.map((item) => item.value.trim().toLowerCase())).size > 1,
    )
    .map(([field, candidates]) => ({ field, candidates }));
}

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
  const candidates = results.flatMap((result) => result.candidates);
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
    provenance.degreeLevel = "extracted";
  }
  const skills = [
    ...new Set([...base.skills, ...(byField.get("skill") ?? []).map((item) => item.value)]),
  ];
  const languages = [
    ...new Set([...base.languages, ...(byField.get("language") ?? []).map((item) => item.value)]),
  ];
  return {
    ...base,
    fullName: value("fullName", base.fullName),
    degreeLevel: degree ? degreeFrom(degree.value) : base.degreeLevel,
    field: value("field", base.field),
    education: [
      {
        ...firstEducation,
        degreeLevel: degree ? degreeFrom(degree.value) : firstEducation.degreeLevel,
        degreeName: value("degreeName", firstEducation.degreeName),
        school: value("school", firstEducation.school),
        field: value("field", firstEducation.field),
      },
      ...base.education.slice(1),
    ],
    gpaValue: value("gpaValue", base.gpaValue),
    gpaScale: value("gpaScale", base.gpaScale),
    graduationDate: value("graduationDate", base.graduationDate ?? "") || null,
    graduationDatePrecision:
      (value(
        "graduationDatePrecision",
        base.graduationDatePrecision ?? "",
      ) as Profile["graduationDatePrecision"]) || null,
    graduationYear:
      Number(value("graduationDate", base.graduationDate ?? "").slice(0, 4)) || base.graduationYear,
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
    sourceDocuments: results.map((result) => result.document),
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
  if (unresolvedConflictCount > 0) {
    return { ok: false, reason: "Resolve every document conflict before making the profile." };
  }
  return { ok: true, reason: "" };
}
