import { describe, expect, it } from "vitest";
import type { FinanceCost, FinanceScenario, FinanceSupport } from "@/domain/types";
import { calculateAffordability } from "@/lib/finance";

const cost = (
  id: string,
  amount: number | null,
  component: FinanceCost["component"] = "tuition",
  patch: Partial<FinanceCost> = {},
): FinanceCost => ({
  id,
  label: id,
  amount,
  currency: "HKD",
  period: "programme",
  component,
  timing: "upfront",
  knowledge: amount === null ? "unknown" : "known",
  source: "user_estimate",
  sourceUrl: null,
  required: true,
  ...patch,
});
const support = (
  id: string,
  amount: number,
  patch: Partial<FinanceSupport> = {},
): FinanceSupport => ({
  id,
  label: id,
  amount,
  currency: "HKD",
  period: "programme",
  component: "tuition",
  timing: "upfront",
  knowledge: "known",
  source: "user_estimate",
  sourceUrl: null,
  kind: "cash",
  award: "confirmed",
  applicable: true,
  ...patch,
});
const scenario = (costs: FinanceCost[], supports: FinanceSupport[]): FinanceScenario => ({
  opportunityId: "test",
  costs,
  supports,
  updatedAt: "2026-10-03T00:00:00Z",
});

describe("transparent affordability calculator", () => {
  it("balances equal known cost and confirmed support", () => {
    expect(
      calculateAffordability(scenario([cost("tuition", 100000)], [support("grant", 100000)]))
        .groups[0]?.baseEventualGap,
    ).toBe(0);
  });
  it("calculates the required HKD multi-cost example", () => {
    const result = calculateAffordability(
      scenario(
        [cost("tuition", 80000), cost("living", 40000, "living"), cost("travel", 5000, "travel")],
        [support("confirmed", 90000)],
      ),
    ).groups[0];
    expect(result?.knownCostSubtotal).toBe(125000);
    expect(result?.baseEventualGap).toBe(35000);
  });
  it("separates later reimbursement from upfront need", () => {
    const result = calculateAffordability(
      scenario(
        [cost("travel", 10000, "travel")],
        [
          support("refund", 10000, {
            component: "travel",
            kind: "reimbursement",
            timing: "later_reimbursement",
          }),
        ],
      ),
    ).groups[0];
    expect(result?.baseEventualGap).toBe(0);
    expect(result?.upfrontNeed).toBe(10000);
  });
  it("keeps required unknown living out of arithmetic and marks total unknown", () => {
    const result = calculateAffordability(
      scenario(
        [cost("tuition", 80000), cost("living", null, "living")],
        [support("waiver", 60000, { kind: "waiver" })],
      ),
    ).groups[0];
    expect(result?.baseEventualGap).toBe(20000);
    expect(result?.totalUnknown).toBe(true);
    expect(result?.unknownComponents).toContain("living");
  });
  it("keeps conditional awards out of the base case", () => {
    const result = calculateAffordability(
      scenario([cost("tuition", 100000)], [support("possible", 60000, { award: "conditional" })]),
    ).groups[0];
    expect(result?.baseEventualGap).toBe(100000);
    expect(result?.ifAwardedGap).toBe(40000);
  });
  it("does not over-deduct duplicate waivers", () => {
    const result = calculateAffordability(
      scenario(
        [cost("tuition", 80000)],
        [
          support("waiver-a", 60000, { kind: "waiver" }),
          support("waiver-b", 60000, { kind: "waiver" }),
        ],
      ),
    ).groups[0];
    expect(result?.baseConfirmedSupport).toBe(80000);
    expect(result?.baseEventualGap).toBe(0);
  });
  it("separates incompatible currencies and periods", () => {
    const result = calculateAffordability(
      scenario(
        [cost("hkd", 1000), cost("usd", 100, "living", { currency: "USD", period: "monthly" })],
        [],
      ),
    );
    expect(result.incompatible).toBe(true);
    expect(result.groups).toHaveLength(2);
  });
});
