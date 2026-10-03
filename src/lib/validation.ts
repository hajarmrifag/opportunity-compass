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

/** Timing only — deliberately independent of eligibility. */
export function deadlineState(iso: string | null | undefined, now = new Date()): { state: DeadlineState; days: number | null } {
  if (!iso) return { state: "unknown", days: null };
  if (!isValidIsoDate(iso)) return { state: "invalid", days: null };
  const end = new Date(iso + "T23:59:59");
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (days < 0) return { state: "expired", days };
  return { state: days <= 14 ? "closing_soon" : "open", days };
}

export const oppKey = (title: string, org: string) =>
  `${title.trim().toLowerCase().replace(/\s+/g, " ")}|${org.trim().toLowerCase().replace(/\s+/g, " ")}`;
