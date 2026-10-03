// Keeps AI document help honest: suggestions may rephrase and reorder, never invent.
// The same rules run on the server (plan-documents) and in the browser.

export interface CvLine {
  id: string; // "L1", "L2", ...
  text: string;
}

export interface Suggestion {
  lineId: string;
  suggested: string;
  reason?: string;
}

export interface CheckedSuggestion extends Suggestion {
  original: string | null;
  rejected: boolean; // never shown as acceptable
  needsConfirmation: boolean; // shown, but unticked by default
  issues: string[];
}

export function splitCv(text: string): CvLine[] {
  return text
    .split(/\r?\n/)
    .map((t) => t.replace(/^[\s•*\-–]+/, "").trim())
    .filter((t) => t.length > 0)
    .map((t, i) => ({ id: `L${i + 1}`, text: t }));
}

export function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*%?/g) ?? []).map((n) => n.replace(/,(?=\d{3}\b)/g, ""));
}

// Common words that may start a rephrased bullet without being a new claim.
const COMMON = new Set(
  (
    "i my we our me a an the and or of for to in on with by at from as led built analysed analyzed managed created developed designed " +
    "organised organized coordinated delivered improved increased reduced supported prepared presented researched wrote " +
    "taught tutored launched ran planned conducted collaborated worked assisted produced achieved selected awarded " +
    "member president vice head lead team project projects university student students experience skills education " +
    "january february march april may june july august september october november december"
  ).split(" "),
);

/** Capitalised words, acronyms and tool names (Excel, Python, CFA, C++). */
export function extractTerms(text: string, skipFirst = true): string[] {
  const tokens = text.match(/[A-Za-z][A-Za-z0-9+#.&'-]*/g) ?? [];
  return tokens
    .filter((t, i) => !(skipFirst && i === 0))
    .map((t) => t.replace(/[.'-]+$/, ""))
    .filter((t) => /[A-Z]/.test(t) || /[+#]/.test(t))
    .filter((t) => !COMMON.has(t.toLowerCase()));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, case-insensitive match ("Excel" does not match "excellent"; works for "C++"). */
export const containsWord = (haystack: string, needle: string) =>
  new RegExp(`(^|[^A-Za-z0-9])${escapeRe(needle)}($|[^A-Za-z0-9])`, "i").test(haystack);

export function checkSuggestion(lines: CvLine[], s: Suggestion): CheckedSuggestion {
  const issues: string[] = [];
  const line = lines.find((l) => l.id === s.lineId) ?? null;
  const fullCv = lines.map((l) => l.text).join("\n");

  if (!line) {
    return { ...s, original: null, rejected: true, needsConfirmation: false, issues: ["Does not match any line in your CV"] };
  }
  if (!s.suggested || s.suggested.trim().length === 0) {
    return { ...s, original: line.text, rejected: true, needsConfirmation: false, issues: ["Empty suggestion"] };
  }

  const originalNumbers = new Set(extractNumbers(line.text));
  const newNumbers = extractNumbers(s.suggested).filter((n) => !originalNumbers.has(n));
  if (newNumbers.length > 0) {
    issues.push(`Adds numbers that are not in this line of your CV: ${newNumbers.join(", ")}`);
    return { ...s, original: line.text, rejected: true, needsConfirmation: false, issues };
  }

  const newTerms = Array.from(new Set(extractTerms(s.suggested).filter((t) => !containsWord(fullCv, t))));
  if (newTerms.length > 0) {
    issues.push(`Mentions something not in your CV: ${newTerms.join(", ")}. Keep it only if it is true.`);
  }

  return { ...s, original: line.text, rejected: false, needsConfirmation: newTerms.length > 0, issues };
}

/** Checks a cover-letter draft: numbers and named terms must come from the CV or the opportunity text. */
export function checkDraft(cvText: string, opportunityText: string, draft: string) {
  const allowed = `${cvText}\n${opportunityText}`;
  const allowedNumbers = new Set(extractNumbers(allowed));
  const newNumbers = Array.from(new Set(extractNumbers(draft).filter((n) => !allowedNumbers.has(n))));
  const sentences = draft.split(/(?<=[.!?])\s+/);
  const newTerms = Array.from(
    new Set(sentences.flatMap((s) => extractTerms(s)).filter((t) => !containsWord(allowed, t))),
  );
  return { newNumbers, newTerms, ok: newNumbers.length === 0 && newTerms.length === 0 };
}
