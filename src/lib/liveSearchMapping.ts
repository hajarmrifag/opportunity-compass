// Client-safe, pure logic for live search: input contract, query building, extraction schema,
// and mapping/validation of extracted page data into the shared Opportunity contract.
// Nothing here calls the network. Nothing here may invent facts: absent => null/unknown.
import { z } from "zod";
import type { Category, CoverageItem, CoverageStatus, Opportunity, Requirement } from "@/domain/types";
import { CATEGORY_LABELS } from "@/domain/types";
import { isValidIsoDate, safeHttpUrl, oppKey } from "./validation";

export const LIVE_MAX_RESULTS = 8;

/** Only non-identifying preferences. Never name, email, CV text or free-form goals. */
export const liveSearchInput = z.object({
  query: z.string().trim().min(2, "Describe what you're looking for").max(200),
  category: z.string().max(30).default("all"),
  location: z.string().trim().max(80).default(""),
  remoteOnly: z.boolean().default(false),
  subject: z.string().trim().max(80).default(""),
  education: z.string().max(30).default(""),
  fundedOnly: z.boolean().default(false),
  deadlineAfter: z.string().max(10).default(""),
});
export type LiveSearchInput = z.infer<typeof liveSearchInput>;

export type LiveSearchError =
  | { code: "not_configured"; message: string }
  | { code: "rate_limited"; message: string }
  | { code: "bad_input"; message: string }
  | { code: "provider_error"; message: string; status?: number };

export interface LiveSearchResponse {
  ok: true;
  results: Opportunity[];
  dropped: number; // pages that were not opportunity listings or failed validation
  cached: boolean;
  retrievedAt: string;
  queryUsed: string;
}

const isCategory = (c: string): c is Category => c in CATEGORY_LABELS;

export function buildQuery(i: LiveSearchInput): string {
  const parts = [i.query];
  if (isCategory(i.category)) parts.push(CATEGORY_LABELS[i.category]);
  if (i.subject) parts.push(i.subject);
  if (i.education) parts.push(i.education);
  if (i.remoteOnly) parts.push("remote");
  else if (i.location) parts.push(i.location);
  if (i.fundedOnly) parts.push("funded");
  parts.push("apply deadline");
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 300);
}

export const cacheKey = (i: LiveSearchInput) => JSON.stringify(liveSearchInput.parse(i));

/** JSON schema sent to the page-extraction step. Instructs extraction from page text only. */
export const EXTRACTION_PROMPT =
  "Extract facts about the single opportunity described on THIS page only. Use only text present on the page. " +
  "If a fact is not explicitly stated, use null (or 'unknown' for coverage). Never guess dates, funding or requirements. " +
  "An official page for ONE specific degree programme (e.g. one university's MSc page or its admissions page), job, internship, fellowship or scholarship counts as a listing (is_opportunity_listing=true). " +
  "Set is_opportunity_listing=false for news, directories or rankings of many programmes, blogs, forums, Q&A sites, social media posts, or search pages. Dates must be YYYY-MM-DD.";

const cov = { type: "string", enum: ["covered", "partial", "not_covered", "unknown"] } as const;
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    is_opportunity_listing: { type: "boolean" },
    title: { type: ["string", "null"] },
    organization: { type: ["string", "null"] },
    category: { type: ["string", "null"], enum: [...Object.keys(CATEGORY_LABELS), null] },
    location: { type: ["string", "null"] },
    mode: { type: ["string", "null"], enum: ["in_person", "remote", "hybrid", null] },
    summary: { type: ["string", "null"] },
    deadline: { type: ["string", "null"] },
    degree_levels: { type: "array", items: { type: "string" } },
    fields_of_study: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    other_requirements: { type: "array", items: { type: "string" } },
    tuition: cov, living: cov, travel: cov,
    funding_note: { type: ["string", "null"] },
    payment_timing: { type: ["string", "null"] },
    apply_url: { type: ["string", "null"] },
  },
  required: ["is_opportunity_listing"],
} as const;

const extracted = z.object({
  is_opportunity_listing: z.boolean(),
  title: z.string().nullish(),
  organization: z.string().nullish(),
  category: z.string().nullish(),
  location: z.string().nullish(),
  mode: z.string().nullish(),
  summary: z.string().nullish(),
  deadline: z.string().nullish(),
  degree_levels: z.array(z.string()).nullish(),
  fields_of_study: z.array(z.string()).nullish(),
  languages: z.array(z.string()).nullish(),
  skills: z.array(z.string()).nullish(),
  other_requirements: z.array(z.string()).nullish(),
  tuition: z.string().nullish(), living: z.string().nullish(), travel: z.string().nullish(),
  funding_note: z.string().nullish(),
  payment_timing: z.string().nullish(),
  apply_url: z.string().nullish(),
}).passthrough();

const DEGREE_MAP: Record<string, string> = {
  "high school": "high_school", secondary: "high_school",
  bachelor: "bachelor", bachelors: "bachelor", undergraduate: "bachelor", "bachelor's": "bachelor",
  master: "master", masters: "master", "master's": "master", postgraduate: "master", graduate: "master",
  phd: "phd", doctoral: "phd", doctorate: "phd",
};
const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n);
const covItem = (s: string | null | undefined, note?: string): CoverageItem => {
  const status: CoverageStatus = s === "covered" || s === "partial" || s === "not_covered" ? s : "unknown";
  return note && status !== "unknown" ? { status, note: clip(note, 200) } : { status };
};
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sameSite = (a: string, b: string) => {
  const x = hostOf(a).split(".").slice(-2).join("."), y = hostOf(b).split(".").slice(-2).join(".");
  return !!x && x === y;
};

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|ref)$/.test(k)) url.searchParams.delete(k);
    return url.toString().replace(/\/$/, "");
  } catch { return u; }
}

/** Short stable id from the source URL (FNV-1a). */
export function idFromUrl(u: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < u.length; i++) { h ^= u.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `live-${(h >>> 0).toString(36)}`;
}

export interface RawSearchHit { url: string; title?: string; description?: string; json?: unknown }

/** Map one provider hit to an Opportunity, or null if it isn't a usable listing. */
export function mapHit(hit: RawSearchHit, retrievedAt: string): Opportunity | null {
  const source = safeHttpUrl(hit.url);
  if (!source) return null;
  const parsed = extracted.safeParse(hit.json);
  if (!parsed.success || !parsed.data.is_opportunity_listing) return null;
  const d = parsed.data;
  const title = clip(d.title, 150) || clip(hit.title, 150);
  if (!title) return null;
  const reqs: Requirement[] = [];
  const degrees = [...new Set((d.degree_levels ?? []).map((x) => DEGREE_MAP[x.trim().toLowerCase()]).filter(Boolean))] as string[];
  if (degrees.length) reqs.push({ id: "deg", kind: "degreeLevel", label: `Degree: ${(d.degree_levels ?? []).join(", ")}`.slice(0, 150), values: degrees });
  else if ((d.degree_levels ?? []).length) reqs.push({ id: "deg", kind: "other", label: `Degree: ${(d.degree_levels ?? []).join(", ")}`.slice(0, 150) });
  if ((d.fields_of_study ?? []).length) reqs.push({ id: "fld", kind: "field", label: `Field: ${d.fields_of_study!.join(", ")}`.slice(0, 150), values: d.fields_of_study!.map((x) => x.toLowerCase()).slice(0, 15) });
  (d.languages ?? []).slice(0, 5).forEach((l, i) => reqs.push({ id: `lang${i}`, kind: "language", label: clip(l, 60), values: [l.toLowerCase()] }));
  (d.skills ?? []).slice(0, 8).forEach((s, i) => reqs.push({ id: `sk${i}`, kind: "skill", label: clip(s, 60), values: [s.toLowerCase()] }));
  (d.other_requirements ?? []).slice(0, 8).forEach((o, i) => reqs.push({ id: `o${i}`, kind: "other", label: clip(o, 150) }));

  const apply = safeHttpUrl(d.apply_url);
  const category = d.category && isCategory(d.category) ? d.category : null;
  const mode = d.mode === "in_person" || d.mode === "remote" || d.mode === "hybrid" ? d.mode : "unknown";
  return {
    id: idFromUrl(normalizeUrl(source)),
    title,
    organization: clip(d.organization, 150) || hostOf(source),
    category: category ?? "job", // display fallback only; see categoryKnown
    location: clip(d.location, 100) || "Unknown",
    mode,
    summary: clip(d.summary, 600) || clip(hit.description, 600) || "No summary on source page.",
    deadline: d.deadline && isValidIsoDate(d.deadline) ? d.deadline : null,
    tags: [...(category ? [category] : ["category-unknown"]), ...(d.fields_of_study ?? []), ...(d.skills ?? [])].map((x) => x.toLowerCase()).slice(0, 20),
    requirements: reqs,
    funding: {
      tuition: covItem(d.tuition, d.funding_note ?? undefined),
      living: covItem(d.living),
      travel: covItem(d.travel),
      paymentTiming: clip(d.payment_timing, 120) || null,
    },
    sourceUrl: source,
    // Only keep an apply link that lives on the same site as the source page.
    applyUrl: apply && sameSite(apply, source) ? apply : null,
    lastVerified: null,
    verification: "web_retrieved",
    isDemo: false,
    retrievedAt,
  };
}

export const categoryKnown = (o: Opportunity) => !o.tags.includes("category-unknown");

/** Dedupe by normalized URL, then by title+organization. */
export function dedupe(list: Opportunity[]): Opportunity[] {
  const seen = new Set<string>();
  return list.filter((o) => {
    const k1 = o.id, k2 = oppKey(o.title, o.organization);
    if (seen.has(k1) || seen.has(k2)) return false;
    seen.add(k1); seen.add(k2);
    return true;
  });
}

/** Post-extraction filters. Unknown values never satisfy a filter. */
export function applyFilters(list: Opportunity[], i: LiveSearchInput, today = new Date()): Opportunity[] {
  return list.filter((o) => {
    if (isCategory(i.category) && (!categoryKnown(o) || o.category !== i.category)) return false;
    if (i.remoteOnly && o.mode !== "remote") return false;
    if (i.fundedOnly && !(["tuition", "living"] as const).some((k) => o.funding[k].status === "covered")) return false;
    if (i.deadlineAfter && isValidIsoDate(i.deadlineAfter)) {
      if (!o.deadline || o.deadline < i.deadlineAfter) return false;
    }
    void today;
    return true;
  });
}
