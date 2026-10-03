import { describe, expect, it } from "vitest";
import { calculate } from "@/features/calculator/calculate";
import { convert } from "@/features/calculator/currency";
import { toCalculatorData, verifiedCoverage } from "@/features/calculator/reviewedData";
import type { CalculatorData, FundingOption, StudentInputs } from "@/features/calculator/types";
import { calculateAffordability } from "@/lib/finance";
import { DEMO_OPPORTUNITIES } from "@/data/fixtures";
import type { Opportunity } from "@/domain/types";

const inputs: StudentInputs = {
  university: null,
  level: null,
  finalYear: null,
  residencyStatus: null,
  passport: null,
  departureCity: "Hong Kong",
  departureCountry: "Hong Kong",
  holdsEntryScholarship: null,
  currency: "HKD",
};
const fund: FundingOption = {
  id: "f1",
  opportunityId: null,
  provider: "Uni",
  name: "Travel grant",
  type: "university_fund",
  amountMin: 3000,
  amountMax: 3000,
  percentCap: null,
  currency: "HKD",
  coversCategories: ["*"],
  competitive: true,
  paidWhen: "after_end",
  rules: {},
  sharedAllowance: false,
  status: "published",
};
const base = (patch: Partial<CalculatorData> = {}): CalculatorData => ({
  opportunity: { id: "o", title: "T", city: "Hong Kong", country: "Hong Kong" },
  meta: null,
  costs: [
    {
      id: "c1",
      opportunityId: "o",
      category: "fee",
      direction: "pay",
      label: "Fee",
      unit: "per_trip",
      amountMin: 5000,
      amountMax: 5000,
      currency: "HKD",
      timing: "before_start",
      status: "published",
    },
  ],
  coverage: [],
  benchmarks: [],
  visaRules: [],
  funding: [fund],
  fxRates: [],
  ...patch,
});

describe("finance handoff rules", () => {
  it("eligibility alone never reduces the base case", () => {
    const r = calculate(base(), inputs);
    expect(r.afterSupport.confirmed.cost).toEqual({ min: 5000, max: 5000 });
    expect(r.afterSupport.bestCase.cost).toEqual({ min: 2000, max: 2000 });
  });
  it("a user-confirmed award reduces the base case", () => {
    const r = calculate(base(), { ...inputs, awardedFundingIds: ["f1"] });
    expect(r.afterSupport.confirmed.cost).toEqual({ min: 2000, max: 2000 });
    expect(r.afterSupport.confirmed.upfront).toEqual({ min: 5000, max: 5000 });
  });
  it("unknown cost makes the total unknown", () => {
    const d = base();
    d.costs.push({ ...d.costs[0]!, id: "c2", amountMin: null, amountMax: null, status: "unknown" });
    const r = calculate(d, inputs);
    expect(r.totalKnown).toBe(false);
    expect(r.totals.cost).toEqual({ min: 5000, max: 5000 });
  });
  it("unverified organiser coverage does not reduce cost", () => {
    const r = calculate(
      base({
        coverage: [
          { opportunityId: "o", coversCategory: "fee", covered: "yes", status: "ai_extracted" },
        ],
      }),
      inputs,
    );
    expect(r.totals.cost).toEqual({ min: 5000, max: 5000 });
  });
  it("uses the latest dated FX rate and never guesses a missing one", () => {
    const rates = [
      { base: "USD", quote: "HKD", rate: 7.7, rateDate: "2026-01-01", source: "a" },
      { base: "USD", quote: "HKD", rate: 7.8, rateDate: "2026-09-01", source: "b" },
    ];
    expect(convert(1, "USD", "HKD", rates)).toMatchObject({ value: 7.8, rateDate: "2026-09-01" });
    expect(convert(1, "JPY", "HKD", rates)).toBeNull();
  });
});

describe("Brief adapter", () => {
  it("demo records and missing reviewed rows fall back to the local calculator", () => {
    const demo = DEMO_OPPORTUNITIES[0]!;
    expect(toCalculatorData(demo, null)).toBeNull();
    expect(verifiedCoverage(demo)).toEqual([]);
  });
  it("only verified sourced records produce organiser coverage", () => {
    const opp: Opportunity = {
      ...DEMO_OPPORTUNITIES[0]!,
      isDemo: false,
      verification: "web_retrieved",
      sourceUrl: "https://example.org",
      funding: { ...DEMO_OPPORTUNITIES[0]!.funding, tuition: { status: "covered" } },
    };
    expect(verifiedCoverage(opp)).toEqual([]);
    expect(verifiedCoverage({ ...opp, verification: "verified" })).toHaveLength(1);
  });
  it("local calculator keeps estimated 'confirmed' support out of the base case", () => {
    const r = calculateAffordability({
      opportunityId: "x",
      updatedAt: "",
      costs: [
        {
          id: "c",
          label: "Fee",
          amount: 1000,
          currency: "HKD",
          period: "programme",
          component: "tuition",
          timing: "upfront",
          knowledge: "known",
          source: "user_estimate",
          sourceUrl: null,
          required: true,
        },
      ],
      supports: [
        {
          id: "s",
          label: "Grant",
          amount: 400,
          currency: "HKD",
          period: "programme",
          component: "tuition",
          timing: "upfront",
          knowledge: "estimated",
          source: "user_estimate",
          sourceUrl: null,
          kind: "cash",
          award: "confirmed",
          applicable: true,
        },
      ],
    }).groups[0];
    expect(r?.baseEventualGap).toBe(1000);
    expect(r?.ifAwardedGap).toBe(600);
  });
});
