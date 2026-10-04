// Strict enough to catch typos: one @, no spaces, no leading/trailing/consecutive
// dots, and a domain ending in a dot + at least two letters.
const EMAIL_RE =
  /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Normalised Passport email, or "" when missing/invalid. */
export function normalizeEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

/** Compare the Passport email with a connected inbox address. */
export function emailMatchState(
  passportEmail: string | null | undefined,
  inboxEmail: string | null | undefined,
): "missing" | "not_connected" | "match" | "mismatch" {
  const a = normalizeEmail(passportEmail);
  if (!a) return "missing";
  const b = normalizeEmail(inboxEmail);
  if (!b) return "not_connected";
  return a === b ? "match" : "mismatch";
}
