// Tracker CSV: template, header mapping, row validation, duplicate detection, export.
import type { Application, ApplicationStatus, Category, Opportunity } from "@/domain/types";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/domain/types";
import { toCsv } from "./csv";
import { isValidIsoDate, oppKey, safeHttpUrl } from "./validation";

export const TRACKER_FIELDS = ["title", "organization", "category", "status", "deadline", "link", "location", "notes"] as const;
export type TrackerField = (typeof TRACKER_FIELDS)[number];
export const REQUIRED_FIELDS: TrackerField[] = ["title", "organization"];
export type Mapping = Record<TrackerField, number>; // -1 = not mapped

const ALIASES: Record<TrackerField, string[]> = {
  title: ["title", "opportunity", "name", "program", "position"],
  organization: ["organization", "organisation", "org", "company", "provider", "institution"],
  category: ["category", "type", "kind"],
  status: ["status", "stage", "application status"],
  deadline: ["deadline", "due", "due date", "closing date"],
  link: ["link", "url", "website", "apply url", "source url"],
  location: ["location", "city", "country", "place"],
  notes: ["notes", "note", "comments", "comment"],
};

export const LIMITS = { title: 150, organization: 150, location: 100, notes: 2000, link: 500 };
export const MAX_ROWS = 500;

export function autoMap(headers: string[]): Mapping {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/[_-]+/g, " "));
  const m = {} as Mapping;
  for (const f of TRACKER_FIELDS) m[f] = norm.findIndex((h) => ALIASES[f].includes(h));
  return m;
}

export function templateCsv(): string {
  return toCsv([
    [...TRACKER_FIELDS],
    ["Example Research Assistant", "Example University (replace me)", "research", "preparing", "2026-12-01", "https://example.org/apply", "Remote", "Ask supervisor for reference, \"draft\" ready"],
  ]);
}

export type DuplicatePolicy = "skip" | "update";

export interface ImportRow {
  line: number; // 1-based CSV line incl. header
  title: string;
  organization: string;
  category: Category;
  status: ApplicationStatus;
  deadline: string | null;
  link: string | null;
  location: string;
  notes: string;
  errors: string[];
  warnings: string[];
  duplicateInFile: boolean;
  existingOppId: string | null;
  existingAppId: string | null;
}

const lookup = <T extends string>(labels: Record<T, string>, raw: string): T | null => {
  const v = raw.trim().toLowerCase();
  return (Object.keys(labels) as T[]).find((k) => k === v || labels[k].toLowerCase() === v) ?? null;
};

export function validateRows(rows: string[][], mapping: Mapping, opps: Opportunity[], apps: Application[]): ImportRow[] {
  const byKey = new Map(opps.map((o) => [oppKey(o.title, o.organization), o]));
  const seen = new Set<string>();
  return rows.slice(0, MAX_ROWS).map((r, idx) => {
    const get = (f: TrackerField) => (mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "");
    const errors: string[] = [];
    const warnings: string[] = [];
    const title = get("title");
    const organization = get("organization");
    if (!title) errors.push("Title is required");
    if (!organization) errors.push("Organization is required");
    for (const f of ["title", "organization", "location", "notes", "link"] as const)
      if (get(f).length > LIMITS[f]) errors.push(`${f} is longer than ${LIMITS[f]} characters`);

    const catRaw = get("category");
    let category: Category = "internship";
    if (catRaw) {
      const c = lookup(CATEGORY_LABELS, catRaw);
      if (c) category = c; else errors.push(`Unknown category "${catRaw}"`);
    } else warnings.push("No category. Defaults to Internship");

    const stRaw = get("status");
    let status: ApplicationStatus = "saved";
    if (stRaw) {
      const s = lookup(STATUS_LABELS, stRaw);
      if (s) status = s; else errors.push(`Unknown status "${stRaw}"`);
    }

    const dRaw = get("deadline");
    let deadline: string | null = null;
    if (dRaw) { if (isValidIsoDate(dRaw)) deadline = dRaw; else errors.push(`Deadline "${dRaw}" is not a real YYYY-MM-DD date`); }

    const lRaw = get("link");
    let link: string | null = null;
    if (lRaw) { link = safeHttpUrl(lRaw); if (!link) errors.push("Link must be a full http(s):// URL"); }

    const key = oppKey(title, organization);
    const duplicateInFile = !!title && !!organization && seen.has(key);
    if (duplicateInFile) warnings.push("Repeats an earlier row. Will be skipped");
    seen.add(key);
    const existing = title && organization ? byKey.get(key) : undefined;
    const existingApp = existing ? apps.find((a) => a.opportunityId === existing.id) : undefined;
    if (existingApp) warnings.push("Already in My Journey");
    else if (existing) warnings.push("Matches an existing opportunity. Will track it");

    return {
      line: idx + 2, title, organization, category, status, deadline, link,
      location: get("location"), notes: get("notes"), errors, warnings, duplicateInFile,
      existingOppId: existing?.id ?? null, existingAppId: existingApp?.id ?? null,
    };
  });
}

export type ImportAction = "create" | "track" | "update" | "skip" | "invalid";
export function actionFor(r: ImportRow, policy: DuplicatePolicy): ImportAction {
  if (r.errors.length) return "invalid";
  if (r.duplicateInFile) return "skip";
  if (r.existingAppId) return policy === "update" ? "update" : "skip";
  if (r.existingOppId) return "track";
  return "create";
}

export function exportCsv(apps: Application[], opps: Opportunity[]): string {
  const rows = apps.map((a) => {
    const o = opps.find((x) => x.id === a.opportunityId);
    return [
      o?.title ?? "(missing)", o?.organization ?? "", o?.category ?? "", a.status,
      a.deadline ?? o?.deadline ?? "", o?.applyUrl ?? o?.sourceUrl ?? "", o?.location ?? "", a.notes,
    ];
  });
  return toCsv([[...TRACKER_FIELDS], ...rows]);
}
