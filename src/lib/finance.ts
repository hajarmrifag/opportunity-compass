import type {
  FinanceComponent,
  FinanceCost,
  FinanceScenario,
  FinanceSupport,
  MoneyPeriod,
} from "@/domain/types";

export interface AffordabilityGroup {
  currency: string;
  period: MoneyPeriod;
  knownCostSubtotal: number;
  baseConfirmedSupport: number;
  conditionalSupport: number;
  baseEventualGap: number;
  ifAwardedGap: number;
  upfrontNeed: number;
  totalUnknown: boolean;
  unknownComponents: FinanceComponent[];
  arithmetic: string[];
}

export interface AffordabilityResult {
  groups: AffordabilityGroup[];
  incompatible: boolean;
}

const keyOf = (value: { currency: string; period: MoneyPeriod }) =>
  `${value.currency.trim().toUpperCase()}|${value.period}`;

const knownAmount = (item: FinanceCost | FinanceSupport) =>
  item.knowledge === "unknown" || item.amount === null ? null : Math.max(0, item.amount);

/**
 * Only a user-confirmed actual award with a known amount reduces the base case.
 * Estimated "confirmed" amounts and competitive/possible awards stay in the if-awarded scenario.
 */
export function baseOrIfAwarded(support: FinanceSupport): "confirmed" | "conditional" {
  return support.award === "confirmed" && support.knowledge === "known"
    ? "confirmed"
    : "conditional";
}

function effectiveSupports(
  costs: FinanceCost[],
  supports: FinanceSupport[],
  award: "confirmed" | "conditional",
) {
  const knownCosts = costs.filter((cost) => knownAmount(cost) !== null);
  const componentCaps = new Map<FinanceComponent, number>();
  for (const cost of knownCosts) {
    const amount = knownAmount(cost) ?? 0;
    if (cost.timing !== "refundable_deposit")
      componentCaps.set(cost.component, (componentCaps.get(cost.component) ?? 0) + amount);
  }
  const waived = new Map<FinanceComponent, number>();
  let total = 0;
  for (const support of supports) {
    if (!support.applicable || baseOrIfAwarded(support) !== award) continue;
    const amount = knownAmount(support);
    if (amount === null) continue;
    if (support.kind === "waiver") {
      const used = waived.get(support.component) ?? 0;
      const available = Math.max(0, (componentCaps.get(support.component) ?? 0) - used);
      const applied = Math.min(amount, available);
      waived.set(support.component, used + applied);
      total += applied;
    } else {
      total += amount;
    }
  }
  return total;
}

export function calculateAffordability(scenario: FinanceScenario): AffordabilityResult {
  const keys = new Set([
    ...scenario.costs.map(keyOf),
    ...scenario.supports.filter((support) => support.applicable).map(keyOf),
  ]);
  const groups = [...keys].sort().map((key) => {
    const [currency = "", period = "one_time"] = key.split("|") as [string, MoneyPeriod];
    const costs = scenario.costs.filter((item) => keyOf(item) === key);
    const supports = scenario.supports.filter((item) => keyOf(item) === key);
    const knownCostSubtotal = costs.reduce((sum, item) => {
      const amount = knownAmount(item);
      return sum + (amount !== null && item.timing !== "refundable_deposit" ? amount : 0);
    }, 0);
    const upfrontCosts = costs.reduce((sum, item) => {
      const amount = knownAmount(item);
      return (
        sum +
        (amount !== null && ["upfront", "refundable_deposit"].includes(item.timing) ? amount : 0)
      );
    }, 0);
    const baseConfirmedSupport = effectiveSupports(costs, supports, "confirmed");
    const conditionalSupport = effectiveSupports(costs, supports, "conditional");
    const upfrontConfirmed = supports.reduce((sum, item) => {
      if (!item.applicable || baseOrIfAwarded(item) !== "confirmed" || item.timing !== "upfront")
        return sum;
      return sum + (knownAmount(item) ?? 0);
    }, 0);
    const unknownComponents = [
      ...new Set(
        costs
          .filter((item) => item.required && knownAmount(item) === null)
          .map((item) => item.component),
      ),
    ];
    const baseEventualGap = Math.max(0, knownCostSubtotal - baseConfirmedSupport);
    const ifAwardedGap = Math.max(0, baseEventualGap - conditionalSupport);
    const upfrontNeed = Math.max(0, upfrontCosts - upfrontConfirmed);
    return {
      currency,
      period,
      knownCostSubtotal,
      baseConfirmedSupport,
      conditionalSupport,
      baseEventualGap,
      ifAwardedGap,
      upfrontNeed,
      totalUnknown: unknownComponents.length > 0,
      unknownComponents,
      arithmetic: [
        `${knownCostSubtotal} known costs − ${baseConfirmedSupport} confirmed applicable support = ${baseEventualGap} base gap`,
        conditionalSupport > 0
          ? `${baseEventualGap} base gap − ${conditionalSupport} conditional support = ${ifAwardedGap} if awarded`
          : "No conditional support is included in the base case.",
        `${upfrontCosts} upfront costs − ${upfrontConfirmed} confirmed upfront support = ${upfrontNeed} upfront need`,
      ],
    };
  });
  return { groups, incompatible: groups.length > 1 };
}

export function emptyFinanceScenario(opportunityId: string): FinanceScenario {
  return { opportunityId, costs: [], supports: [], updatedAt: new Date().toISOString() };
}
