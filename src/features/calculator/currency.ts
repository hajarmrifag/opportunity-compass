import type { FxRate } from "./types";

export interface Conversion {
  value: number;
  rateDate: string | null;
  sources: string[];
}

const PIVOTS = ["EUR", "USD", "HKD", "GBP"];

/** Finds the most recent rate for base→quote (direct or inverse). */
function findRate(rates: FxRate[], from: string, to: string): { rate: number; date: string; source: string } | null {
  let best: { rate: number; date: string; source: string } | null = null;
  for (const r of rates) {
    let candidate: { rate: number; date: string; source: string } | null = null;
    if (r.base === from && r.quote === to) candidate = { rate: r.rate, date: r.rateDate, source: r.source };
    else if (r.base === to && r.quote === from && r.rate !== 0)
      candidate = { rate: 1 / r.rate, date: r.rateDate, source: r.source };
    if (candidate && (!best || candidate.date > best.date)) best = candidate;
  }
  return best;
}

/**
 * Converts an amount between currencies using stored rates.
 * Tries a direct/inverse rate first, then a cross rate through a pivot currency.
 * Returns null if no path exists – callers must show "Conversion unavailable", never guess.
 */
export function convert(amount: number, from: string, to: string, rates: FxRate[]): Conversion | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return { value: amount, rateDate: null, sources: [] };

  const direct = findRate(rates, f, t);
  if (direct) return { value: amount * direct.rate, rateDate: direct.date, sources: [direct.source] };

  for (const pivot of PIVOTS) {
    if (pivot === f || pivot === t) continue;
    const a = findRate(rates, f, pivot);
    const b = findRate(rates, pivot, t);
    if (a && b) {
      const older = a.date < b.date ? a.date : b.date;
      return { value: amount * a.rate * b.rate, rateDate: older, sources: Array.from(new Set([a.source, b.source])) };
    }
  }
  return null;
}

const WHOLE_UNIT_CURRENCIES = new Set(["GBP", "EUR", "USD", "SGD", "CHF", "AUD", "CAD"]);

/** Display-only rounding. Calculations always use full precision. */
export function roundForDisplay(value: number, currency: string): number {
  if (WHOLE_UNIT_CURRENCIES.has(currency.toUpperCase())) return Math.round(value);
  return Math.round(value / 10) * 10;
}

export function formatMoney(value: number, currency: string, approximate = false): string {
  const rounded = roundForDisplay(value, currency);
  let text: string;
  try {
    text = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    text = `${rounded.toLocaleString("en-GB")} ${currency.toUpperCase()}`;
  }
  return approximate ? `≈ ${text}` : text;
}

export function formatRange(range: { min: number; max: number }, currency: string, approximate = false): string {
  const lo = roundForDisplay(range.min, currency);
  const hi = roundForDisplay(range.max, currency);
  if (lo === hi) return formatMoney(range.min, currency, approximate);
  return `${formatMoney(range.min, currency, approximate)}–${formatMoney(range.max, currency)}`;
}
