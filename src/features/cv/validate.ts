// Input checks for the CV builder. Pure functions, so they are easy to test.
// "error" blocks moving on; "warning" is advice only.

export interface FieldIssue {
  level: "error" | "warning";
  message: string;
}

export const LIMITS = {
  name: 60,
  email: 254, // maximum length of an email address
  phone: 20, // characters including spaces, +, -, brackets
  phoneDigitsMin: 7,
  phoneDigitsMax: 15, // international (E.164) maximum
  city: 60,
  link: 200,
  title: 100,
  organisation: 100,
  dates: 40,
  point: 250,
  item: 50, // one skill, language or award
  skills: 15,
  languages: 8,
  awards: 8,
} as const;

export function checkName(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [{ level: "error", message: "Add your full name." }];
  const out: FieldIssue[] = [];
  if (s.length > LIMITS.name) out.push({ level: "error", message: `Keep your name under ${LIMITS.name} characters.` });
  if (/\d/.test(s)) out.push({ level: "warning", message: "Names usually don't contain numbers. Check for a typo." });
  return out;
}

export function checkEmail(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [{ level: "warning", message: "Add an email so employers can contact you." }];
  if (s.length > LIMITS.email) return [{ level: "error", message: `Email addresses can be at most ${LIMITS.email} characters.` }];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return [{ level: "error", message: "This doesn't look like an email address (name@example.com)." }];
  const local = s.split("@")[0] ?? "";
  if (local.length > 64) return [{ level: "error", message: "The part before @ can be at most 64 characters." }];
  return [];
}

export function checkPhone(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [];
  if (/[^\d\s+\-()]/.test(s)) return [{ level: "error", message: "Use only digits, spaces, +, - and brackets." }];
  if (s.indexOf("+") > 0 || (s.match(/\+/g) ?? []).length > 1) return [{ level: "error", message: "+ can only appear once, at the start." }];
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits > LIMITS.phoneDigitsMax)
    return [{ level: "error", message: `Too many digits: phone numbers have at most ${LIMITS.phoneDigitsMax} (you have ${digits}).` }];
  if (digits < LIMITS.phoneDigitsMin) return [{ level: "error", message: `Too few digits for a phone number (at least ${LIMITS.phoneDigitsMin}).` }];
  if (!s.startsWith("+")) return [{ level: "warning", message: "Add your country code, e.g. +852, so employers abroad can call you." }];
  return [];
}

/**
 * Cleans phone input while typing: keeps digits, spaces, -, brackets and one leading +,
 * and stops at the maximum number of digits.
 */
export function sanitizePhone(raw: string): string {
  let out = "";
  let digits = 0;
  for (const ch of raw) {
    if (/\d/.test(ch)) {
      if (digits >= LIMITS.phoneDigitsMax) continue;
      digits++;
      out += ch;
    } else if (ch === "+") {
      if (out.trim() === "" && !out.includes("+")) out += ch;
    } else if (/[\s\-()]/.test(ch)) {
      out += ch;
    }
  }
  return out.slice(0, LIMITS.phone);
}

export const countDigits = (v: string) => (v.match(/\d/g) ?? []).length;

export function checkCity(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [];
  if (s.length > LIMITS.city) return [{ level: "error", message: `Keep the city under ${LIMITS.city} characters.` }];
  if (/^\d+$/.test(s)) return [{ level: "error", message: "This doesn't look like a city." }];
  return [];
}

export function checkLink(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [];
  if (s.length > LIMITS.link) return [{ level: "error", message: `Keep links under ${LIMITS.link} characters.` }];
  if (/\s/.test(s) || !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s))
    return [{ level: "error", message: "This doesn't look like a web address (e.g. linkedin.com/in/your-name)." }];
  return [];
}

export function checkPoint(v: string): FieldIssue[] {
  const long = v
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > LIMITS.point);
  return long.length ? [{ level: "warning", message: "Some points are very long. Short points (under 2 lines) read better." }] : [];
}

export const hasError = (issues: FieldIssue[]) => issues.some((i) => i.level === "error");

/** Adds an item to a list: trimmed, length-limited, no duplicates (case-insensitive), capped in number. */
export function addItem(list: string[], item: string, max: number): { list: string[]; issue: string | null } {
  const s = item.trim().replace(/\s+/g, " ");
  if (!s) return { list, issue: null };
  if (s.length > LIMITS.item) return { list, issue: `Keep each item under ${LIMITS.item} characters.` };
  if (list.some((x) => x.toLowerCase() === s.toLowerCase())) return { list, issue: "Already added." };
  if (list.length >= max) return { list, issue: `You can add up to ${max}. Keep the most relevant ones.` };
  return { list: [...list, s], issue: null };
}

export const LANGUAGE_LEVELS = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const formatLanguage = (name: string, level: LanguageLevel | "") => (level ? `${name.trim()} (${level})` : name.trim());

export function formatAward(name: string, year: string): string {
  const n = name.trim();
  const y = year.trim();
  return y ? `${n} (${y})` : n;
}

export function checkYear(v: string): FieldIssue[] {
  const s = v.trim();
  if (!s) return [];
  return /^(19|20)\d{2}$/.test(s) ? [] : [{ level: "error", message: "Use a 4-digit year, e.g. 2025." }];
}
