import { convert } from "./currency";
import { evaluateEligibility } from "./eligibility";
import type {
  CalculationResult,
  CalculatorData,
  CoverageState,
  FundingOption,
  FundingResult,
  LineCategory,
  LineResult,
  Mode,
  OpportunityCoverage,
  Range,
  ScenarioResult,
  StudentInputs,
  Timing,
  TravelCategory,
  Unit,
} from "./types";

// ---------- Location helpers ----------

const CITY_ALIASES: Record<string, string> = {
  hk: "hong kong",
  "hong kong sar": "hong kong",
  "hong kong s.a.r.": "hong kong",
  "hksar": "hong kong",
  "香港": "hong kong",
  "london, uk": "london",
};

const COUNTRY_ALIASES: Record<string, string> = {
  uk: "united kingdom",
  "u.k.": "united kingdom",
  "great britain": "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  wales: "united kingdom",
  "northern ireland": "united kingdom",
  hk: "hong kong",
  "hong kong sar": "hong kong",
  "hong kong, china": "hong kong",
  "mainland china": "china",
  prc: "china",
  usa: "united states",
  us: "united states",
};

export function normalizeCity(city: string | null | undefined): string {
  const c = (city ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return CITY_ALIASES[c] ?? c;
}

export function normalizeCountry(country: string | null | undefined): string {
  const c = (country ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return COUNTRY_ALIASES[c] ?? c;
}

export function detectMode(data: CalculatorData, inputs: StudentInputs): Mode | null {
  if (inputs.modeOverride) return inputs.modeOverride;
  const oppCity = normalizeCity(data.opportunity.city);
  if (!oppCity) return null;
  return oppCity === normalizeCity(inputs.departureCity) ? "local" : "travel";
}

// ---------- Small helpers ----------

function multiplier(unit: Unit, nights: number, days: number): number {
  switch (unit) {
    case "per_trip":
      return 1;
    case "per_night":
      return nights;
    case "per_day":
      return days;
    case "per_month":
      return Math.max(1, Math.ceil(days / 30));
  }
}

const TRAVEL_TIMING: Record<TravelCategory, Timing> = {
  flight: "before_start",
  accommodation: "before_start",
  food: "during",
  local_transport: "during",
};

function coverageFor(
  category: LineCategory,
  coverage: OpportunityCoverage[],
  defaultState: CoverageState,
): { state: CoverageState; note?: string | null } {
  const specific = coverage.find((c) => c.coversCategory === category);
  const general = coverage.find((c) => c.coversCategory === "*");
  const entry = specific ?? general;
  if (!entry) return { state: defaultState };
  // A scraped or unsourced "yes" is a lead to verify, not confirmed coverage.
  const verified = entry.status === "published" && Boolean(entry.sourceUrl);
  const state: CoverageState = entry.covered === "yes" ? (verified ? "covered" : "unknown") : entry.covered === "no" ? "not_covered" : "unknown";
  return { state, note: entry.note };
}

const sumRange = (lines: LineResult[]): Range =>
  lines.reduce((acc, l) => ({ min: acc.min + (l.converted?.min ?? 0), max: acc.max + (l.converted?.max ?? 0) }), {
    min: 0,
    max: 0,
  });

// ---------- Main calculation ----------

/**
 * Pure, deterministic calculation. No network, no AI, no randomness.
 * The UI calls this with data loaded from the calc_ tables and the student's confirmed inputs.
 */
export function calculate(data: CalculatorData, inputs: StudentInputs): CalculationResult {
  const currency = inputs.currency.toUpperCase();
  const mode = detectMode(data, inputs);
  const meta = data.meta;
  const nights = mode === "travel" ? Math.max(0, inputs.nightsOverride ?? meta?.nights ?? 0) : 0;
  const days = mode === "travel" ? nights + 1 : Math.max(1, meta?.durationDays ?? 1);

  const unknownItems: string[] = [];
  let requiredCostUnknown = false;
  const conversionUnavailable = new Set<string>();
  const fxSources = new Set<string>();
  let fxLatest: string | null = null;

  const toRange = (min: number | null, max: number | null, from: string, mult: number): Range | null => {
    if (min === null || max === null) return null;
    const a = convert(min * mult, from, currency, data.fxRates);
    const b = convert(max * mult, from, currency, data.fxRates);
    if (!a || !b) {
      conversionUnavailable.add(from.toUpperCase());
      return null;
    }
    for (const c of [a, b]) {
      c.sources.forEach((s) => fxSources.add(s));
      if (c.rateDate && (!fxLatest || c.rateDate > fxLatest)) fxLatest = c.rateDate;
    }
    return { min: a.value, max: b.value };
  };

  // 1) Costs and income written on the opportunity's own page
  const eventLines: LineResult[] = [];
  const receiveLines: LineResult[] = [];
  for (const c of data.costs) {
    const mult = multiplier(c.unit, nights, days);
    const isUnknown = c.status === "unknown" || c.amountMin === null || c.amountMax === null;
    const converted = isUnknown ? null : toRange(c.amountMin, c.amountMax, c.currency, mult);
    const cov = c.direction === "pay" ? coverageFor(c.category, data.coverage, "not_covered") : { state: "not_covered" as CoverageState };
    const line: LineResult = {
      key: `cost-${c.id}`,
      group: c.direction === "receive" ? "receive" : "event",
      category: c.category,
      label: c.label,
      converted,
      original: {
        min: c.amountMin === null ? null : c.amountMin * mult,
        max: c.amountMax === null ? null : c.amountMax * mult,
        currency: c.currency,
      },
      status: c.status,
      coverage: cov.state,
      includedInTotal: !isUnknown && converted !== null && cov.state !== "covered" && c.direction === "pay",
      timing: c.timing,
      unknownReason: isUnknown ? "Not stated on the official page" : undefined,
      sourceUrl: c.sourceUrl,
      checkedDate: c.checkedDate,
      evidenceQuote: c.evidenceQuote,
      note: cov.note ?? c.note,
    };
    if (isUnknown) {
      unknownItems.push(`${c.label}: not stated on the official page`);
      if (c.direction === "pay") requiredCostUnknown = true;
    }
    (c.direction === "receive" ? receiveLines : eventLines).push(line);
  }
  if (mode !== null && data.costs.filter((c) => c.direction === "pay").length === 0) {
    unknownItems.push("Costs of the opportunity itself: no information recorded yet");
    requiredCostUnknown = true;
  }

  // 2) Travel costs (only in travel mode)
  const travelLines: LineResult[] = [];
  let travelUnavailable = false;
  if (mode === "travel") {
    const origin = normalizeCity(inputs.departureCity);
    const dest = normalizeCity(data.opportunity.city);
    const benchmarks = data.benchmarks.filter(
      (b) => normalizeCity(b.originCity) === origin && normalizeCity(b.destinationCity) === dest,
    );
    if (benchmarks.length === 0) {
      travelUnavailable = true;
      unknownItems.push(`Travel estimates not yet available for ${data.opportunity.city ?? "this destination"}`);
      requiredCostUnknown = true;
    } else {
      for (const category of ["flight", "accommodation", "food", "local_transport"] as const) {
        if (!benchmarks.some((b) => b.category === category)) {
          unknownItems.push(`${category.replace("_", " ")}: no travel estimate recorded`);
          requiredCostUnknown = true;
        }
      }
    }
    for (const b of benchmarks) {
      const mult = multiplier(b.unit, nights, days);
      const converted = toRange(b.amountMin, b.amountMax, b.currency, mult);
      const cov = coverageFor(b.category, data.coverage, "unknown");
      travelLines.push({
        key: `travel-${b.category}`,
        group: "travel",
        category: b.category,
        label: labelForTravel(b.category, nights, days),
        converted,
        original: { min: b.amountMin * mult, max: b.amountMax * mult, currency: b.currency },
        status: b.status,
        coverage: cov.state,
        includedInTotal: converted !== null && cov.state !== "covered",
        timing: TRAVEL_TIMING[b.category],
        sourceUrl: b.sourceUrl,
        checkedDate: b.checkedDate,
        note: cov.note ?? b.note,
      });
    }

    // 3) Visa / travel authorisation
    const destCountry = normalizeCountry(data.opportunity.country);
    const homeCountry = normalizeCountry(inputs.departureCountry);
    if (destCountry && destCountry !== homeCountry) {
      const passport = inputs.passport;
      const checkWhere = destCountry === "united kingdom" ? "check gov.uk" : "check the official immigration website";
      if (!passport || passport === "Other" || passport === "Prefer not to say") {
        unknownItems.push("Visa or travel authorisation: depends on your passport");
        requiredCostUnknown = true;
        travelLines.push(unknownVisaLine(`Depends on your passport – ${checkWhere}`));
      } else {
        const rules = data.visaRules.filter(
          (v) => normalizeCountry(v.destinationCountry) === destCountry && v.passport === passport,
        );
        if (rules.length === 0) {
          unknownItems.push("Visa or travel authorisation: no information for your passport yet");
          requiredCostUnknown = true;
          travelLines.push(unknownVisaLine(`No information for your passport yet – ${checkWhere}`));
        }
        for (const v of rules) {
          const converted = toRange(v.amount, v.amount, v.currency, 1);
          const cov = coverageFor("visa", data.coverage, "not_covered");
          travelLines.push({
            key: `visa-${v.passport}`,
            group: "visa",
            category: "visa",
            label: v.label,
            converted,
            original: { min: v.amount, max: v.amount, currency: v.currency },
            status: v.status,
            coverage: cov.state,
            includedInTotal: converted !== null && cov.state !== "covered",
            timing: "before_start",
            sourceUrl: v.sourceUrl,
            checkedDate: v.checkedDate,
            note: v.leadTimeNote,
          });
        }
      }
    }
  }

  // 4) Totals
  const costLines = [...eventLines, ...travelLines].filter((l) => l.includedInTotal);
  const blockedByConversion = [...eventLines, ...travelLines, ...receiveLines].some(
    (l) => l.converted === null && l.original.min !== null && l.status !== "unknown",
  );
  const hasKnownCosts = costLines.length > 0 || eventLines.some((l) => l.coverage === "covered");
  const cost: Range | null = blockedByConversion || mode === null || !hasKnownCosts ? null : sumRange(costLines);
  const upfront: Range | null = cost === null ? null : sumRange(costLines.filter((l) => l.timing === "before_start"));
  const receive: Range | null =
    receiveLines.length === 0 || receiveLines.some((l) => l.converted === null) ? null : sumRange(receiveLines);

  // 5) Funding
  const relevantFunding = data.funding.filter((f) => f.opportunityId === null || f.opportunityId === data.opportunity.id);
  const evaluated = relevantFunding.map((option) => {
    const { eligibility, reasons } = evaluateEligibility(option, inputs, meta);
    let capacity: Range | null = null;
    const notes: string[] = [];
    if (option.amountMin !== null && option.amountMax !== null) {
      capacity = toRange(option.amountMin, option.amountMax, option.currency, 1);
      if (!capacity) notes.push(`Conversion unavailable for ${option.currency}`);
    } else if (option.percentCap === null) {
      notes.push("Amount not published");
    }
    if (option.sharedAllowance) notes.push("Shared allowance: using it here reduces what is left for other activities");
    if (option.paidWhen === "after_end") notes.push("Paid after the activity, so it does not reduce cash needed upfront");
    return { option, eligibility, reasons, capacity, notes };
  });

  const awarded = new Set(inputs.awardedFundingIds ?? []);
  const confirmedSet = evaluated.filter((e) => awarded.has(e.option.id));
  const bestCaseSet = evaluated.filter((e) => e.eligibility !== "not_eligible");

  const confirmed = applySupport(cost, costLines, confirmedSet);
  const bestCase = applySupport(cost, costLines, bestCaseSet);

  const funding: FundingResult[] = evaluated.map((e) => ({
    option: e.option,
    eligibility: e.eligibility,
    reasons: e.reasons,
    capacity: e.capacity,
    appliedConfirmed: confirmed.applied.get(e.option.id) ?? { min: 0, max: 0 },
    appliedBestCase: bestCase.applied.get(e.option.id) ?? { min: 0, max: 0 },
    notes: e.notes,
  }));

  const unknownLineCount = unknownItems.length;
  return {
    mode,
    currency,
    nights,
    days,
    eventLines,
    travelLines,
    receiveLines,
    totals: { cost, upfront, receive },
    afterSupport: { confirmed: confirmed.scenario, bestCase: bestCase.scenario },
    funding,
    unknownItems,
    isIncomplete: unknownLineCount > 0 || conversionUnavailable.size > 0 || mode === null,
    totalKnown: !requiredCostUnknown && conversionUnavailable.size === 0 && mode !== null,
    travelUnavailable,
    conversionUnavailable: Array.from(conversionUnavailable),
    fx: fxSources.size > 0 ? { sources: Array.from(fxSources), latestDate: fxLatest } : null,
  };
}

function labelForTravel(category: TravelCategory, nights: number, days: number): string {
  switch (category) {
    case "flight":
      return "Return flight";
    case "accommodation":
      return `Accommodation, ${nights} night${nights === 1 ? "" : "s"}`;
    case "food":
      return `Food, ${days} day${days === 1 ? "" : "s"}`;
    case "local_transport":
      return "Local transport";
  }
}

function unknownVisaLine(reason: string): LineResult {
  return {
    key: "visa-unknown",
    group: "visa",
    category: "visa",
    label: "Visa or travel authorisation",
    converted: null,
    original: { min: null, max: null, currency: "" },
    status: "unknown",
    coverage: "not_covered",
    includedInTotal: false,
    timing: "before_start",
    unknownReason: reason,
  };
}

// ---------- Support allocation ----------

interface Evaluated {
  option: FundingOption;
  capacity: Range | null;
}

/**
 * Applies support without double counting.
 * Low end of the range: lowest costs with the highest support amount.
 * High end of the range: highest costs with the lowest support amount.
 * Support only covers its listed categories, never goes below zero,
 * and only support paid before the start reduces cash needed upfront.
 */
function applySupport(
  cost: Range | null,
  lines: LineResult[],
  options: Evaluated[],
): { scenario: ScenarioResult; applied: Map<string, Range> } {
  const applied = new Map<string, Range>();
  if (cost === null) return { scenario: { cost: null, upfront: null }, applied };

  const ordered = [...options].sort((a, b) => Number(a.option.competitive) - Number(b.option.competitive));

  const run = (end: "min" | "max") => {
    const remaining = lines.map((l) => ({ line: l, value: l.converted ? l.converted[end] : 0 }));
    const upfrontStart = remaining.filter((r) => r.line.timing === "before_start").reduce((s, r) => s + r.value, 0);
    let upfrontReduction = 0;
    const perOption = new Map<string, number>();

    for (const e of ordered) {
      const o = e.option;
      const covered = remaining
        .filter((r) => o.coversCategories.includes("*") || o.coversCategories.includes(r.line.category))
        // allocate to before_start lines first so upfront relief is shown where it applies
        .sort((a, b) => Number(a.line.timing !== "before_start") - Number(b.line.timing !== "before_start"));
      const coveredTotal = covered.reduce((s, r) => s + r.value, 0);

      let capacity = 0;
      if (e.capacity) capacity = end === "min" ? e.capacity.max : e.capacity.min;
      else if (o.percentCap !== null) capacity = o.percentCap * coveredTotal;

      let left = Math.min(capacity, coveredTotal);
      const used = left;
      for (const r of covered) {
        if (left <= 0) break;
        const take = Math.min(left, r.value);
        r.value -= take;
        left -= take;
        if (o.paidWhen === "before_start" && r.line.timing === "before_start") upfrontReduction += take;
      }
      perOption.set(o.id, used);
    }

    const after = remaining.reduce((s, r) => s + r.value, 0);
    return { cost: Math.max(0, after), upfront: Math.max(0, upfrontStart - upfrontReduction), perOption };
  };

  const low = run("min");
  const high = run("max");
  for (const e of ordered) {
    const a = low.perOption.get(e.option.id) ?? 0;
    const b = high.perOption.get(e.option.id) ?? 0;
    applied.set(e.option.id, { min: Math.min(a, b), max: Math.max(a, b) });
  }
  return {
    scenario: { cost: { min: low.cost, max: high.cost }, upfront: { min: low.upfront, max: high.upfront } },
    applied,
  };
}
