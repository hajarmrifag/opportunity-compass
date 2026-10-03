// Small deterministic DEMO matcher. Replace with the real matching engine via EligibilityAdapter.
import type {
  EligibilityAdapter, EligibilityResult, Opportunity, Profile, Requirement, RequirementResult,
} from "@/domain/types";
import { DEGREE_LABELS } from "@/domain/types";

const norm = (s: string) => s.trim().toLowerCase();

function check(req: Requirement, p: Profile): RequirementResult {
  const r = (status: RequirementResult["status"], reason: string) => ({ requirement: req, status, reason });
  const vals = (req.values ?? []).map(norm);
  switch (req.kind) {
    case "degreeLevel":
      if (!p.degreeLevel) return r("unknown", "Degree level missing from Passport");
      return vals.includes(p.degreeLevel)
        ? r("met", `Passport: ${DEGREE_LABELS[p.degreeLevel]}`)
        : r("not_met", `Passport: ${DEGREE_LABELS[p.degreeLevel]}`);
    case "field":
      if (!p.field.trim()) return r("unknown", "Field of study missing from Passport");
      return vals.includes(norm(p.field)) ? r("met", `Passport: ${p.field}`) : r("not_met", `Passport: ${p.field}`);
    case "graduationYear": {
      const y = p.graduationYear;
      if (!y) return r("unknown", "Graduation year missing from Passport");
      const ok = (req.min == null || y >= req.min) && (req.max == null || y <= req.max);
      return r(ok ? "met" : "not_met", `Passport: ${y}`);
    }
    case "skill": {
      if (p.skills.length === 0) return r("unknown", "No skills listed in Passport");
      const hit = p.skills.find((s) => vals.includes(norm(s)));
      return hit ? r("met", `Passport lists ${hit}`) : r("not_met", "Not listed in Passport skills");
    }
    case "language": {
      if (p.languages.length === 0) return r("unknown", "No languages listed in Passport");
      const hit = p.languages.find((s) => vals.includes(norm(s)));
      return hit ? r("met", `Passport lists ${hit}`) : r("not_met", "Not listed in Passport languages");
    }
    default:
      return r("unknown", "Cannot be checked automatically — verify yourself");
  }
}

export const demoEligibilityAdapter: EligibilityAdapter = {
  evaluate(profile: Profile | null, opp: Opportunity): EligibilityResult {
    const basis = "Based on demo criteria";
    if (!profile || !profile.confirmed) {
      return {
        opportunityId: opp.id,
        overall: "incomplete",
        requirements: opp.requirements.map((req) => ({
          requirement: req, status: "unknown", reason: "Confirm your Passport to check this",
        })),
        relevance: { level: "low", reasons: ["Confirm your Passport to see relevance"] },
        basis,
      };
    }
    const results = opp.requirements.map((req) => check(req, profile));
    const overall = results.some((x) => x.status === "not_met")
      ? "not_eligible"
      : results.some((x) => x.status === "unknown") || results.length === 0
        ? "incomplete"
        : "meets_listed_criteria";

    const reasons: string[] = [];
    if (profile.preferences.categories.includes(opp.category)) reasons.push("Matches a category you prefer");
    const tags = opp.tags.map(norm);
    if (profile.field && tags.includes(norm(profile.field))) reasons.push(`Related to your field (${profile.field})`);
    const skillHits = profile.skills.filter((s) => tags.includes(norm(s)));
    if (skillHits.length) reasons.push(`Uses your skills: ${skillHits.join(", ")}`);
    const roles = profile.workExperience ?? [];
    const hasResearch = roles.some((r) => r.type === "research" || /research|lab\b|thesis/i.test(`${r.role} ${r.organization}`));
    const hasVolunteer = roles.some((r) => r.type === "volunteer" || /volunteer/i.test(r.role));
    if (hasResearch && (opp.category === "research" || opp.category === "fellowship" || tags.includes("research")))
      reasons.push("You listed research experience");
    if (hasVolunteer && tags.some((t) => /volunteer|community|social|impact/.test(t)))
      reasons.push("You listed volunteer experience");
    if (profile.preferences.remoteOk && opp.mode === "remote") reasons.push("Remote, which you accept");
    const needs = profile.fundingNeeds;
    if ((needs.tuition && opp.funding.tuition.status === "covered") || (needs.living && opp.funding.living.status === "covered"))
      reasons.push("Covers a funding need you listed");
    const level = reasons.length >= 3 ? "high" : reasons.length >= 1 ? "medium" : "low";
    if (!reasons.length) reasons.push("Few overlaps with your Passport preferences");
    return { opportunityId: opp.id, overall, requirements: results, relevance: { level, reasons }, basis };
  },
};
