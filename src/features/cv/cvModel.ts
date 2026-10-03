// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { containsWord, extractNumbers, extractTerms } from "../plan/cvGuard";
import type { BuilderAnswers, BuilderEntry, CheckedChange, CvChange, CvDocument, CvEntry, CvSection, Fact } from "./types";

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const KNOWN_SECTIONS = [
  "education", "experience", "work experience", "professional experience", "employment", "internships",
  "leadership", "activities", "extracurricular activities", "leadership and activities", "projects",
  "skills", "languages", "skills and languages", "awards", "achievements", "honours", "honors",
  "certifications", "certificates", "volunteering", "volunteer experience", "summary", "profile",
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s-]{6,}\d)/;
const URL_RE = /(https?:\/\/\S+|linkedin\.com\/\S+)/i;

/** Fallback when AI structuring is unavailable: keeps every line exactly as written. */
export function cvFromPlainText(text: string): CvDocument {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^[\s•*\-–]+/, "").trim()).filter(Boolean);
  const doc: CvDocument = { name: lines[0] ?? "", contact: {}, sections: [] };
  let current: CvSection | null = null;
  for (const line of lines.slice(1)) {
    const email = line.match(EMAIL)?.[0];
    const phone = line.match(PHONE)?.[0];
    const url = line.match(URL_RE)?.[0];
    if (!current && (email || phone || url) && line.length < 120) {
      if (email) doc.contact.email = email;
      if (phone) doc.contact.phone = phone.trim();
      if (url) doc.contact.links = [...(doc.contact.links ?? []), url];
      continue;
    }
    if (KNOWN_SECTIONS.includes(line.toLowerCase().replace(/[:]$/, ""))) {
      current = { id: newId("s"), title: line.replace(/[:]$/, ""), entries: [{ id: newId("e"), heading: "", bullets: [] }] };
      doc.sections.push(current);
      continue;
    }
    if (!current) {
      current = { id: newId("s"), title: "Details", entries: [{ id: newId("e"), heading: "", bullets: [] }] };
      doc.sections.push(current);
    }
    current.entries[0].bullets.push({ id: newId("b"), text: line });
  }
  return doc;
}

const splitPoints = (description: string) =>
  description
    .split(/\r?\n|;\s+/)
    .map((p) => p.replace(/^[\s•*\-–]+/, "").trim())
    .filter(Boolean);

function entryFrom(e: BuilderEntry): CvEntry {
  return {
    id: newId("e"),
    heading: e.title.trim(),
    subheading: e.organisation.trim() || undefined,
    location: e.location?.trim() || undefined,
    dates: e.dates?.trim() || undefined,
    bullets: splitPoints(e.description).map((t) => ({ id: newId("b"), text: t })),
  };
}

/** Builds a first CV from the student's own answers. No AI, no rewording: every word is theirs. */
export function buildFromAnswers(a: BuilderAnswers): CvDocument {
  const sections: CvSection[] = [];
  const add = (title: string, entries: BuilderEntry[]) => {
    const filled = entries.filter((e) => e.title.trim() || e.organisation.trim() || e.description.trim());
    if (filled.length) sections.push({ id: newId("s"), title, entries: filled.map(entryFrom) });
  };
  add("Education", a.education);
  add("Experience", a.experience);
  add("Leadership and activities", a.activities);
  add("Projects", a.projects);

  const extras: CvEntry[] = [];
  const line = (label: string, value?: string) =>
    value && value.trim() ? extras.push({ id: newId("e"), heading: label, bullets: [{ id: newId("b"), text: value.trim() }] }) : null;
  line("Skills", a.skills);
  line("Languages", a.languages);
  line("Awards", a.awards);
  if (extras.length) sections.push({ id: newId("s"), title: "Skills, languages and awards", entries: extras });

  return {
    name: a.name.trim(),
    contact: {
      email: a.email?.trim() || undefined,
      phone: a.phone?.trim() || undefined,
      location: a.city?.trim() || undefined,
      links: a.links?.trim() ? a.links.split(/[\s,]+/).filter(Boolean) : undefined,
    },
    sections,
  };
}

/** Every piece of text in the CV becomes an allowed fact. */
export function factsFromCv(doc: CvDocument, source: Fact["source"] = "cv"): Fact[] {
  const facts: Fact[] = [];
  const push = (text?: string) => text && text.trim() && facts.push({ id: `F${facts.length + 1}`, text: text.trim(), source });
  push(doc.name);
  if (doc.summary) push(doc.summary);
  for (const s of doc.sections) {
    for (const e of s.entries) {
      push([e.heading, e.subheading, e.location, e.dates].filter(Boolean).join(", "));
      e.bullets.forEach((b) => push(b.text));
    }
  }
  return facts;
}

export function flattenCv(doc: CvDocument): string {
  const out: string[] = [doc.name];
  const contact = [doc.contact.email, doc.contact.phone, doc.contact.location, ...(doc.contact.links ?? [])].filter(Boolean);
  if (contact.length) out.push(contact.join(" | "));
  if (doc.summary) out.push("", doc.summary);
  for (const s of doc.sections) {
    out.push("", s.title.toUpperCase());
    for (const e of s.entries) {
      const head = [e.heading, e.subheading, e.location, e.dates].filter(Boolean).join(" | ");
      if (head) out.push(head);
      e.bullets.forEach((b) => out.push(`• ${b.text}`));
    }
  }
  return out.join("\n");
}

export function findBullet(doc: CvDocument, bulletId: string): { section: CvSection; entry: CvEntry; text: string } | null {
  for (const section of doc.sections)
    for (const entry of section.entries) {
      const b = entry.bullets.find((x) => x.id === bulletId);
      if (b) return { section, entry, text: b.text };
    }
  return null;
}

/**
 * Facts-only check for one proposed change.
 * - New numbers: edits may only use numbers from that line or from what the student told us; additions only numbers from the facts.
 *   Otherwise the change is removed.
 * - New names, tools or skills not in the facts (or the opportunity's own name): shown unticked, "keep only if true".
 * - Removing or reordering never adds a claim, so it is always allowed.
 */
export function checkChange(doc: CvDocument, facts: Fact[], opportunityText: string, change: CvChange, id = newId("c")): CheckedChange {
  const base = { id, change, issues: [] as string[] };
  const factText = facts.map((f) => f.text).join("\n");
  const studentNumbers = new Set(facts.filter((f) => f.source !== "cv").flatMap((f) => extractNumbers(f.text)));
  const allNumbers = new Set(extractNumbers(factText));

  if (change.kind === "remove_bullet" || change.kind === "move_section") {
    const before =
      change.kind === "remove_bullet"
        ? findBullet(doc, change.bulletId)?.text ?? null
        : doc.sections.find((s) => s.id === change.sectionId)?.title ?? null;
    if (change.kind === "remove_bullet" && before === null)
      return { ...base, before, rejected: true, needsConfirmation: false, issues: ["That line is not in your CV"] };
    if (change.kind === "move_section" && !doc.sections.some((s) => s.id === change.sectionId))
      return { ...base, before, rejected: true, needsConfirmation: false, issues: ["That section is not in your CV"] };
    return { ...base, before, rejected: false, needsConfirmation: false };
  }

  const text = change.newText?.trim() ?? "";
  if (!text) return { ...base, before: null, rejected: true, needsConfirmation: false, issues: ["Empty suggestion"] };

  let before: string | null = null;
  let allowedNumbers = allNumbers;
  if (change.kind === "edit_bullet") {
    const found = findBullet(doc, change.bulletId);
    if (!found) return { ...base, before: null, rejected: true, needsConfirmation: false, issues: ["That line is not in your CV"] };
    before = found.text;
    allowedNumbers = new Set([...extractNumbers(found.text), ...studentNumbers]);
  }
  if (change.kind === "add_bullet" && !doc.sections.some((s) => s.entries.some((e) => e.id === change.entryId)))
    return { ...base, before: null, rejected: true, needsConfirmation: false, issues: ["That part of your CV does not exist"] };
  if (change.kind === "edit_summary") before = doc.summary ?? null;

  const newNumbers = extractNumbers(text).filter((n) => !allowedNumbers.has(n));
  if (newNumbers.length)
    return { ...base, before, rejected: true, needsConfirmation: false, issues: [`Adds numbers you have not given: ${newNumbers.join(", ")}`] };

  const allowedText = `${factText}\n${opportunityText}`;
  const newTerms = Array.from(new Set(text.split(/(?<=[.!?])\s+/).flatMap((s) => extractTerms(s)).filter((t) => !containsWord(allowedText, t))));
  const issues = newTerms.length ? [`Mentions something you have not told us: ${newTerms.join(", ")}. Keep it only if it is true.`] : [];
  return { ...base, before, rejected: false, needsConfirmation: newTerms.length > 0, issues };
}

const clone = (d: CvDocument): CvDocument => JSON.parse(JSON.stringify(d));

export function applyChange(doc: CvDocument, change: CvChange): CvDocument {
  const next = clone(doc);
  switch (change.kind) {
    case "edit_bullet":
      for (const s of next.sections) for (const e of s.entries) for (const b of e.bullets) if (b.id === change.bulletId) b.text = change.newText.trim();
      return next;
    case "add_bullet":
      for (const s of next.sections) for (const e of s.entries) if (e.id === change.entryId) e.bullets.push({ id: newId("b"), text: change.newText.trim() });
      return next;
    case "remove_bullet":
      for (const s of next.sections) for (const e of s.entries) e.bullets = e.bullets.filter((b) => b.id !== change.bulletId);
      return next;
    case "move_section": {
      const i = next.sections.findIndex((s) => s.id === change.sectionId);
      if (i < 0) return next;
      const [sec] = next.sections.splice(i, 1);
      next.sections.splice(Math.max(0, Math.min(change.toIndex, next.sections.length)), 0, sec);
      return next;
    }
    case "edit_summary":
      next.summary = change.newText.trim();
      return next;
  }
}

/** Facts the student states in the chat are accepted only if the quoted words really are in their message. */
export function acceptStudentFacts(
  proposed: Array<{ text: string; quote: string }>,
  lastUserMessage: string,
  existing: Fact[],
): Fact[] {
  const msg = lastUserMessage.toLowerCase().replace(/\s+/g, " ");
  const added: Fact[] = [];
  for (const p of proposed) {
    const q = (p.quote ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (q.length < 3 || !msg.includes(q)) continue;
    // Store the student's own words, not the AI's paraphrase.
    added.push({ id: `S${existing.length + added.length + 1}`, text: p.quote.trim(), source: "student" });
  }
  return added;
}
