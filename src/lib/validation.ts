// Shared, dependency-free validators used by UI, CSV import and the store.

/** True only for a real calendar date in strict YYYY-MM-DD form (rejects 2026-02-31). */
export function isValidIsoDate(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Only absolute http(s) URLs are ever rendered as links. */
export function safeHttpUrl(s: string | null | undefined): string | null {
  if (!s) return null;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type DeadlineState = "open" | "closing_soon" | "expired" | "unknown" | "invalid";

/**
 * Timing only — deliberately independent of eligibility.
 * Date-only deadlines are compared as whole calendar days in the user's local timezone:
 * both dates are anchored at local midnight, and DST is absorbed by rounding.
 */
export function deadlineState(iso: string | null | undefined, now = new Date()): { state: DeadlineState; days: number | null } {
  if (!iso) return { state: "unknown", days: null };
  if (!isValidIsoDate(iso)) return { state: "invalid", days: null };
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const due = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { state: "expired", days };
  return { state: days <= DEADLINE_WINDOW_DAYS ? "closing_soon" : "open", days };
}

/** Single source for the "approaching deadline" window used by chips and the dashboard. */
export const DEADLINE_WINDOW_DAYS = 14;

export const oppKey = (title: string, org: string) =>
  `${title.trim().toLowerCase().replace(/\s+/g, " ")}|${org.trim().toLowerCase().replace(/\s+/g, " ")}`;
