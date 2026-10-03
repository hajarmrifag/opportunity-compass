// OpportunityOS – Trip Cost & Funding Calculator
// Shared types. All amounts are stored in their ORIGINAL currency and converted only for display/calculation.

export type Status = "published" | "estimated" | "unknown" | "ai_extracted";
export type Unit = "per_trip" | "per_night" | "per_day" | "per_month";
export type Timing = "before_start" | "during" | "after_end";
export type Mode = "local" | "travel";

export type TravelCategory = "flight" | "accommodation" | "food" | "local_transport";
export type OpportunityCostCategory =
  "fee" | "ticket" | "deposit" | "registration" | "materials" | "stipend" | "salary" | "other";
export type LineCategory = TravelCategory | OpportunityCostCategory | "visa";

export type ActivityType =
  | "insight_programme"
  | "internship"
  | "event"
  | "competition"
  | "conference"
  | "exchange"
  | "summer_school"
  | "other";

/** Minimal view of an opportunity, read from the team's existing opportunities table. */
export interface OpportunityRef {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  officialUrl?: string | null;
}

/** calc_meta: per-opportunity settings for the calculator. */
export interface CalculatorMeta {
  opportunityId: string;
  nights: number; // 0 for local
  durationDays?: number | null; // optional; used for per_month items (e.g. a 60-day internship)
  creditBearing: boolean | null;
  activityType: ActivityType;
}

/** calc_opportunity_costs: costs/income written on the opportunity's own page. */
export interface OpportunityCost {
  id: string;
  opportunityId: string;
  category: OpportunityCostCategory;
  direction: "pay" | "receive";
  label: string;
  unit: Unit;
  amountMin: number | null;
  amountMax: number | null;
  currency: string;
  timing: Timing;
  status: Status;
  evidenceQuote?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  checkedDate?: string | null | undefined;
  note?: string | null | undefined;
}

/** calc_opportunity_coverage: what the organiser/employer covers. */
export interface OpportunityCoverage {
  opportunityId: string;
  coversCategory: LineCategory | "*";
  covered: "yes" | "no" | "unknown";
  note?: string | null | undefined;
  evidenceQuote?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  status: Status;
}

/** calc_destination_benchmarks: researched once per route/city, reused by every opportunity there. */
export interface DestinationBenchmark {
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
  category: TravelCategory;
  unit: Unit;
  amountMin: number;
  amountMax: number;
  currency: string;
  status: Status;
  sourceUrl?: string | null | undefined;
  checkedDate?: string | null | undefined;
  note?: string | null | undefined;
}

/** calc_visa_rules */
export interface VisaRule {
  destinationCountry: string;
  passport: string; // e.g. "Hong Kong SAR", "Mainland China"
  label: string;
  amount: number;
  currency: string;
  leadTimeNote?: string | null;
  status: Status;
  sourceUrl?: string | null | undefined;
  checkedDate?: string | null | undefined;
}

export interface FundingRules {
  university?: string;
  level?: "UG" | "PG";
  excludeFinalYear?: boolean;
  residencyStatus?: "local" | "non_local";
  requiresEntryScholarship?: boolean;
  requiresCreditBearing?: boolean;
  allowedActivityTypes?: ActivityType[];
}

/** calc_funding_options */
export interface FundingOption {
  id: string;
  opportunityId: string | null; // null = general fund
  provider: string;
  name: string;
  type: "employer_coverage" | "university_fund" | "government" | "external";
  amountMin: number | null;
  amountMax: number | null;
  percentCap: number | null; // e.g. 0.667
  currency: string;
  coversCategories: Array<LineCategory | "*">;
  competitive: boolean;
  paidWhen: "before_start" | "after_end" | "unknown";
  rules: FundingRules;
  sharedAllowance: boolean;
  applyDeadline?: string | null;
  status: Status;
  sourceUrl?: string | null | undefined;
  checkedDate?: string | null | undefined;
  note?: string | null | undefined;
}

/** calc_fx_rates: 1 base = rate × quote */
export interface FxRate {
  base: string;
  quote: string;
  rate: number;
  rateDate: string;
  source: string;
}

export type PassportChoice =
  "Hong Kong SAR" | "Mainland China" | "Other" | "Prefer not to say" | null;

export interface StudentInputs {
  university: string | null;
  level: "UG" | "PG" | null;
  finalYear: boolean | null;
  residencyStatus: "local" | "non_local" | "prefer_not" | null;
  passport: PassportChoice;
  departureCity: string; // default "Hong Kong"
  departureCountry: string; // default "Hong Kong"
  holdsEntryScholarship: "yes" | "no" | "not_sure" | null;
  currency: string; // display currency, default "HKD"
  nightsOverride?: number | null;
  modeOverride?: Mode | null; // used when the opportunity location is missing
  /** User-confirmed awards, never inferred from eligibility. Stored with private student inputs. */
  awardedFundingIds?: string[];
}

export interface CalculatorData {
  opportunity: OpportunityRef;
  meta: CalculatorMeta | null;
  costs: OpportunityCost[];
  coverage: OpportunityCoverage[];
  benchmarks: DestinationBenchmark[];
  visaRules: VisaRule[];
  funding: FundingOption[];
  fxRates: FxRate[];
}

export type CoverageState = "covered" | "not_covered" | "unknown";

export interface Range {
  min: number;
  max: number;
}

export interface LineResult {
  key: string;
  group: "event" | "travel" | "visa" | "receive";
  category: LineCategory;
  label: string;
  converted: Range | null; // null if unknown or not convertible
  original: { min: number | null; max: number | null; currency: string };
  status: Status;
  coverage: CoverageState;
  includedInTotal: boolean;
  timing: Timing;
  unknownReason?: string | undefined;
  sourceUrl?: string | null | undefined;
  checkedDate?: string | null | undefined;
  evidenceQuote?: string | null | undefined;
  note?: string | null | undefined;
}

export type Eligibility = "eligible" | "needs_confirmation" | "not_eligible";

export interface FundingResult {
  option: FundingOption;
  eligibility: Eligibility;
  reasons: string[];
  capacity: Range | null; // converted to display currency, null if amount unknown
  appliedConfirmed: Range; // support counted in "Confirmed only"
  appliedBestCase: Range; // support counted in "Best case"
  notes: string[];
}

export interface ScenarioResult {
  cost: Range | null;
  upfront: Range | null;
}

export interface CalculationResult {
  mode: Mode | null; // null = location missing and no override
  currency: string;
  nights: number;
  days: number;
  eventLines: LineResult[];
  travelLines: LineResult[];
  receiveLines: LineResult[];
  totals: {
    cost: Range | null;
    upfront: Range | null;
    receive: Range | null;
  };
  afterSupport: {
    confirmed: ScenarioResult;
    bestCase: ScenarioResult;
  };
  funding: FundingResult[];
  unknownItems: string[];
  isIncomplete: boolean;
  /** False means numeric cost figures are known subtotals, not a complete total. */
  totalKnown: boolean;
  travelUnavailable: boolean;
  conversionUnavailable: string[]; // original currencies that could not be converted
  fx: { sources: string[]; latestDate: string | null } | null;
}
