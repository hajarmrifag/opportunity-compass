// Adapter between this app's contracts and the finance teammate's pure calculator.
// Cloud has no reviewed calc rows wired into this app yet, so callers receive null
// and the Brief falls back to the student's local scenario (src/lib/finance.ts).
import type { Opportunity } from "@/domain/types";
import { safeHttpUrl } from "@/lib/validation";
import type { CalculatorData, OpportunityCoverage } from "./types";

export type ReviewedFinanceRows = Omit<CalculatorData, "opportunity" | "coverage">;

/** Organiser coverage only from a human-verified record with a usable source link. */
export function verifiedCoverage(opp: Opportunity): OpportunityCoverage[] {
  const sourceUrl = safeHttpUrl(opp.sourceUrl);
  if (opp.isDemo || opp.verification !== "verified" || !sourceUrl) return [];
  const map = { tuition: "fee", living: "accommodation", travel: "flight" } as const;
  return (Object.keys(map) as (keyof typeof map)[])
    .filter((key) => opp.funding[key].status === "covered")
    .map((key) => ({
      opportunityId: opp.id,
      coversCategory: map[key],
      covered: "yes" as const,
      note: opp.funding[key].note ?? null,
      sourceUrl,
      status: "published" as const,
    }));
}

/**
 * Returns calculator input only when reviewed cost or funding rows exist.
 * Demo records never feed reviewed finance data.
 */
export function toCalculatorData(
  opp: Opportunity,
  rows: ReviewedFinanceRows | null,
): CalculatorData | null {
  if (!rows || opp.isDemo) return null;
  if (rows.costs.length === 0 && rows.funding.length === 0) return null;
  const [city = null, country = null] = opp.location.split(",").map((part) => part.trim() || null);
  return {
    opportunity: { id: opp.id, title: opp.title, city, country, officialUrl: opp.applyUrl },
    coverage: verifiedCoverage(opp),
    ...rows,
  };
}
