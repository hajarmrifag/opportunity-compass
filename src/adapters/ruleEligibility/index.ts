// Part B — rule-based eligibility & relevance engine.
// Pure + synchronous: no network, AI, storage or randomness. Implements EligibilityAdapter.
import type {
  EligibilityAdapter,
  EligibilityResult,
  Opportunity,
  Profile,
  RelevanceBand,
  Requirement,
  RequirementResult,
  RequirementStatus,
} from "@/domain/types";
import { CATEGORY_LABELS, DEGREE_LABELS } from "@/domain/types";
import { deadlineState } from "@/lib/validation";

type Importance = "mandatory" | "preferred" | "unclear";
const NP = "Not provided";
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Small deterministic string hash (djb2) used for freshness versions. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function profileVersion(p: Profile | null): string {
  if (!p) return "none";
  return `p-${hash(
    JSON.stringify([
      p.confirmed,
      p.confirmedAt,
      p.degreeLevel,
      p.field,
      p.graduationYear,
      p.skills,
      p.languages,
      p.preferences,
      p.goals,
      p.gpaValue,
      p.gpaScale,
      p.education,
    ]),
  )}`;
}

export function opportunityVersion(o: Opportunity): string {
  return `o-${hash(
    JSON.stringify([
      o.id,
      o.title,
      o.deadline,
      o.requirements,
      o.tags,
      o.category,
      o.location,
      o.mode,
      o.lastVerified,
      o.retrievedAt ?? null,
    ]),
  )}`;
}

export function basisFor(o: Opportunity): string {
  if (o.isDemo) return "Based on demo criteria";
  if (o.verification === "verified" && o.lastVerified)
    return `Based on criteria verified ${o.lastVerified}`;
  if (o.verification === "web_retrieved")
    return "Based on requirements extracted from the source page (not human-verified)";
  if (o.verification === "user_entered") return "Based on requirements you entered";
  return "Based on supplied information (not verified)";
}

function importanceOf(req: Requirement, o: Opportunity): Importance {
  if (req.importance) return req.importance;
  // Web-retrieved listings often contain many extracted items; without an explicit flag
  // we cannot know which are hard requirements, so they become notes needing verification.
  return o.verification === "web_retrieved" ? "unclear" : "mandatory";
}

function studentFields(p: Profile): string[] {
  return [p.field, ...(p.education ?? []).map((e) => e.field)].map(norm).filter(Boolean);
}

function checkOne(req: Requirement, p: Profile, source: string): RequirementResult {
  const vals = (req.values ?? []).map(norm).filter(Boolean);
  const required = req.gpa
    ? `${req.gpa.min} on a ${req.gpa.scale} scale`
    : vals.length
      ? vals.join(" or ")
      : req.min != null || req.max != null
        ? `${req.min ?? "any"}–${req.max ?? "any"}`
        : req.label.trim() || "Requirement text missing";
  const out = (
    status: RequirementStatus,
    reason: string,
    studentValue: string,
    note?: string,
  ): RequirementResult => ({
    requirement: req,
    status,
    detailStatus: status,
    reason,
    requiredValue: required,
    studentValue,
    source,
    ...(note ? { note } : {}),
  });

  if (!req.label.trim() && !vals.length && req.min == null && req.max == null && !req.gpa)
    return out(
      "unknown",
      "Requirement text is missing — this is not the same as no restriction",
      NP,
      "Check the official site for the actual wording.",
    );

  if (req.gpa) {
    if (!p.gpaValue.trim() || !p.gpaScale.trim())
      return out("unknown", "GPA or GPA scale missing from Passport", NP);
    const sv = `${p.gpaValue} on a ${p.gpaScale} scale`;
    if (norm(p.gpaScale) !== norm(req.gpa.scale))
      return out(
        "unknown",
        "Different GPA scale — not converted",
        sv,
        "Scales differ; ask the provider how they compare grades.",
      );
    const g = Number(p.gpaValue);
    if (!Number.isFinite(g)) return out("unknown", "GPA in Passport is not a number", sv);
    return out(g >= req.gpa.min ? "met" : "not_met", `Passport GPA ${p.gpaValue}`, sv);
  }

  switch (req.kind) {
    case "degreeLevel": {
      if (!vals.length)
        return out(
          "unknown",
          "Required degree level not stated",
          p.degreeLevel ? DEGREE_LABELS[p.degreeLevel] : NP,
        );
      if (!p.degreeLevel) return out("unknown", "Degree level missing from Passport", NP);
      const sv = DEGREE_LABELS[p.degreeLevel];
      return out(vals.includes(p.degreeLevel) ? "met" : "not_met", `Passport: ${sv}`, sv);
    }
    case "field": {
      const fs = studentFields(p);
      if (!vals.length) return out("unknown", "Required field not stated", p.field || NP);
      if (!fs.length) return out("unknown", "Field of study missing from Passport", NP);
      return out(
        fs.some((f) => vals.includes(f)) ? "met" : "not_met",
        `Passport: ${p.field || fs[0]}`,
        p.field || fs[0]!,
      );
    }
    case "graduationYear": {
      if (req.min == null && req.max == null)
        return out(
          "unknown",
          "Graduation window not stated",
          p.graduationYear ? String(p.graduationYear) : NP,
        );
      const y = p.graduationYear;
      if (!y) return out("unknown", "Graduation year missing from Passport", NP);
      const ok = (req.min == null || y >= req.min) && (req.max == null || y <= req.max);
      return out(ok ? "met" : "not_met", `Passport: ${y}`, String(y));
    }
    case "skill": {
      if (!vals.length) return out("unknown", "Skill not specified", NP);
      const hit = p.skills.find((s) => vals.includes(norm(s)));
      if (hit) return out("met", `Passport lists ${hit}`, hit);
      return out(
        "unknown",
        p.skills.length
          ? "Not listed in your Passport skills — confirm yourself"
          : "No skills listed in Passport",
        p.skills.length ? p.skills.join(", ") : NP,
      );
    }
    case "language": {
      if (!vals.length) return out("unknown", "Language not specified", NP);
      const hit = p.languages.find((s) => vals.includes(norm(s)));
      if (hit)
        return out(
          "met",
          `Passport lists ${hit}`,
          hit,
          "Required proficiency level is not checked automatically.",
        );
      return out(
        "unknown",
        p.languages.length
          ? "Not listed in your Passport languages — confirm yourself"
          : "No languages listed in Passport",
        p.languages.length ? p.languages.join(", ") : NP,
      );
    }
    default:
      // Work rights, nationality, visa, language level etc. are never inferred.
      return out(
        "unknown",
        "Cannot be checked automatically — verify yourself",
        NP,
        "Confirm on the official site.",
      );
  }
}

function combine(statuses: RequirementStatus[], logic: "AND" | "OR"): RequirementStatus {
  if (logic === "OR") {
    if (statuses.includes("met")) return "met";
    if (statuses.length && statuses.every((s) => s === "not_met")) return "not_met";
    return "unknown";
  }
  if (statuses.includes("not_met")) return "not_met";
  if (statuses.includes("unknown") || !statuses.length) return "unknown";
  return "met";
}

const BAND_LEVEL: Record<RelevanceBand, "high" | "medium" | "low"> = {
  strong: "high",
  possible: "medium",
  weak: "low",
  not_enough_information: "low",
};

function relevance(p: Profile, o: Opportunity): { band: RelevanceBand; reasons: string[] } {
  const hasSignals =
    !!p.field.trim() ||
    p.skills.length > 0 ||
    p.preferences.categories.length > 0 ||
    p.preferences.locations.length > 0 ||
    !!p.goals.trim();
  if (!hasSignals)
    return {
      band: "not_enough_information",
      reasons: ["Add field, skills, preferences or goals to your Passport to see relevance"],
    };
  const reasons: string[] = [];
  const tags = o.tags.map(norm);
  const hay = norm(`${o.title} ${o.summary} ${o.tags.join(" ")}`);
  if (p.preferences.categories.includes(o.category))
    reasons.push(`${CATEGORY_LABELS[o.category]} is a type you prefer`);
  const f = studentFields(p).find((x) => tags.includes(x) || hay.includes(x));
  if (f) reasons.push(`Related to your field (${f})`);
  const skills = p.skills.filter((s) => tags.includes(norm(s)));
  if (skills.length) reasons.push(`Uses your skills: ${skills.join(", ")}`);
  const loc = p.preferences.locations.find((l) => norm(l) && norm(o.location).includes(norm(l)));
  if (loc) reasons.push(`In a location you prefer (${loc})`);
  if (p.preferences.remoteOk && o.mode === "remote") reasons.push("Remote, which you accept");
  const goalWords = [
    ...new Set(
      norm(p.goals)
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5),
    ),
  ];
  const gw = goalWords.filter((w) => hay.includes(w)).slice(0, 3);
  if (gw.length) reasons.push(`Mentions words from your goals: ${gw.join(", ")}`);
  const band: RelevanceBand =
    reasons.length >= 3 ? "strong" : reasons.length >= 1 ? "possible" : "weak";
  if (!reasons.length)
    reasons.push("Few overlaps with your Passport field, skills, preferences or goals");
  return { band, reasons };
}

/** Same as the adapter, with an injectable clock for tests. */
export function evaluateRules(
  profile: Profile | null,
  opp: Opportunity,
  now: Date = new Date(),
): EligibilityResult {
  const base = {
    opportunityId: opp.id,
    basis: basisFor(opp),
    deadline: deadlineState(opp.deadline, now),
    profileVersion: profileVersion(profile),
    opportunityVersion: opportunityVersion(opp),
  };
  const source = opp.isDemo
    ? "Fictional demo listing"
    : opp.sourceUrl
      ? `Source page${opp.retrievedAt ? ` (retrieved ${opp.retrievedAt.slice(0, 10)})` : ""}`
      : opp.verification === "user_entered"
        ? "Entered by you"
        : "Unknown source";

  if (!profile || !profile.confirmed) {
    return {
      ...base,
      overall: "incomplete",
      requirements: opp.requirements.map((req) => ({
        requirement: req,
        status: "unknown",
        detailStatus: "unknown",
        reason: "Confirm your Passport to check this",
        importance: importanceOf(req, opp),
        requiredValue: req.label || "Requirement text missing",
        studentValue: NP,
        source,
      })),
      relevance: {
        level: "low",
        band: "not_enough_information",
        reasons: ["Confirm your Passport to see relevance"],
      },
      notes: ["Your Passport is not confirmed, so nothing has been checked."],
    };
  }

  const results = opp.requirements.map((req) => ({
    ...checkOne(req, profile, source),
    importance: importanceOf(req, opp),
  }));
  const notes: string[] = [];

  // Group mandatory requirements; ungrouped ones are their own group.
  const groups = new Map<string, { logic: "AND" | "OR"; idx: number[] }>();
  results.forEach((r, i) => {
    if (r.importance !== "mandatory") return;
    const key = r.requirement.groupId ? `g:${r.requirement.groupId}` : `s:${i}`;
    const g = groups.get(key) ?? { logic: "AND" as const, idx: [] };
    if (r.requirement.groupLogic) g.logic = r.requirement.groupLogic;
    g.idx.push(i);
    groups.set(key, g);
  });
  const groupStatuses: RequirementStatus[] = [];
  for (const g of groups.values()) {
    const s = combine(
      g.idx.map((i) => results[i]!.status),
      g.logic,
    );
    groupStatuses.push(s);
    if (g.logic === "OR" && s === "met")
      g.idx.forEach((i) => {
        if (results[i]!.status !== "met") {
          results[i]!.detailStatus = "not_applicable";
          results[i]!.note = "An alternative in this group is already met.";
        }
      });
  }

  for (const r of results) {
    if (r.importance === "preferred" && r.status !== "met")
      notes.push(`Preferred (does not change your status): ${r.requirement.label} — ${r.reason}`);
    if (r.importance === "unclear")
      notes.push(`Needs verification — not clear if required: ${r.requirement.label}`);
  }

  const overall: EligibilityResult["overall"] = groupStatuses.includes("not_met")
    ? "not_eligible"
    : groupStatuses.includes("unknown") || groupStatuses.length === 0
      ? "incomplete"
      : "meets_listed_criteria";
  if (groupStatuses.length === 0)
    notes.push(
      opp.requirements.length
        ? "No requirement is marked as mandatory — confirm on the official site."
        : "No requirements listed — this does not mean there are none.",
    );

  const rel = relevance(profile, opp);
  return {
    ...base,
    overall,
    requirements: results,
    relevance: { level: BAND_LEVEL[rel.band], band: rel.band, reasons: rel.reasons },
    notes,
  };
}

export const ruleEligibilityAdapter: EligibilityAdapter = {
  evaluate: (profile, opportunity) => evaluateRules(profile, opportunity),
};

export const OVERALL_LABELS: Record<EligibilityResult["overall"], string> = {
  meets_listed_criteria: "Eligible based on supplied information",
  not_eligible: "Not eligible",
  incomplete: "Needs confirmation",
};

export const BAND_LABELS: Record<RelevanceBand, string> = {
  strong: "Strong fit",
  possible: "Possible fit",
  weak: "Weak fit",
  not_enough_information: "Not enough information",
};
