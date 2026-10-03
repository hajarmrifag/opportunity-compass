import type { CalculatorMeta, Eligibility, FundingOption, StudentInputs } from "./types";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Evaluates one funding option against the student's confirmed inputs and the opportunity.
 * - not_eligible: a rule clearly fails (reason shown)
 * - needs_confirmation: nothing fails, but an input/status is unknown or the activity is not explicitly listed
 * - eligible: every rule passes with known inputs and the option's status is published
 * Never infers passport, residency or nationality.
 */
export function evaluateEligibility(
  option: FundingOption,
  inputs: StudentInputs,
  meta: CalculatorMeta | null,
): { eligibility: Eligibility; reasons: string[] } {
  const fails: string[] = [];
  const unsure: string[] = [];
  const r = option.rules ?? {};

  if (r.university) {
    if (!inputs.university)
      unsure.push(`Confirm your university (only for ${r.university} students)`);
    else if (norm(inputs.university) !== norm(r.university))
      fails.push(`Only for ${r.university} students`);
  }

  if (r.level) {
    if (!inputs.level) unsure.push(`Confirm your level of study (${r.level} only)`);
    else if (inputs.level !== r.level)
      fails.push(`Only for ${r.level === "UG" ? "undergraduate" : "postgraduate"} students`);
  }

  if (r.excludeFinalYear) {
    if (inputs.finalYear === null) unsure.push("Confirm whether you are in your final year");
    else if (inputs.finalYear) fails.push("Final-year students are not eligible");
  }

  if (r.residencyStatus) {
    if (!inputs.residencyStatus || inputs.residencyStatus === "prefer_not")
      unsure.push(
        `Depends on residency status (${r.residencyStatus === "local" ? "local" : "non-local"} students only)`,
      );
    else if (inputs.residencyStatus !== r.residencyStatus)
      fails.push(`Only for ${r.residencyStatus === "local" ? "local" : "non-local"} students`);
  }

  if (r.requiresEntryScholarship) {
    if (inputs.holdsEntryScholarship === "no") fails.push("Requires an academic Entry Scholarship");
    else if (inputs.holdsEntryScholarship !== "yes")
      unsure.push("Confirm whether you hold an academic Entry Scholarship");
  }

  if (r.requiresCreditBearing) {
    if (!meta || meta.creditBearing === null)
      unsure.push("Confirm whether this activity is credit-bearing");
    else if (!meta.creditBearing)
      fails.push("Requires a credit-bearing or formally assessed activity");
  }

  if (r.allowedActivityTypes && r.allowedActivityTypes.length > 0) {
    const activity = meta?.activityType ?? null;
    if (!activity) unsure.push("Confirm the type of activity");
    else if (!r.allowedActivityTypes.includes(activity)) {
      // An open-ended list ("other") means it might still qualify; a closed list is a clear failure.
      if (r.allowedActivityTypes.includes("other"))
        unsure.push("This activity type is not explicitly listed; check with the provider");
      else fails.push(`Only for: ${r.allowedActivityTypes.join(", ").replace(/_/g, " ")}`);
    }
  }

  if (option.status === "unknown") unsure.push("Not published; ask the provider");
  if (option.status === "ai_extracted") unsure.push("Extracted automatically; not yet reviewed");

  if (fails.length > 0) return { eligibility: "not_eligible", reasons: fails };
  if (unsure.length > 0) return { eligibility: "needs_confirmation", reasons: unsure };
  if (option.status !== "published")
    return {
      eligibility: "needs_confirmation",
      reasons: ["Amount is an estimate; confirm with the provider"],
    };
  return {
    eligibility: "eligible",
    reasons: ["Meets all listed conditions based on the information you gave"],
  };
}
