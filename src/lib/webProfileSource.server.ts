// Reads ONE student-supplied public link through the linked Firecrawl connection, then
// runs the same structured extraction used for documents. Page text is never stored or logged.
import type { DocumentExtractionResult, DocumentLabel } from "@/domain/types";
import { extractProfileDocument } from "./profileExtraction.server";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const MAX_CHARS = 30_000;

const fail = (name: string, label: DocumentLabel, error: string): DocumentExtractionResult => ({
  ok: false,
  document: { name, label },
  candidates: [],
  experiences: [],
  warnings: [],
  error,
});

// Signs that we got a login wall instead of the person's profile.
const AUTH_WALL =
  /(sign in to (view|see)|join linkedin|log in to linkedin|authwall|sign in to linkedin|agree & join)/i;

export async function extractWebSource(
  input: { url: string; label: DocumentLabel },
  signal?: AbortSignal,
  runId?: string,
): Promise<DocumentExtractionResult> {
  const name = input.url;
  const fc = process.env["FIRECRAWL_API_KEY"];
  const lov = process.env["LOVABLE_API_KEY"];
  if (!fc || !lov) return fail(name, input.label, "Reading web links is not connected yet.");
  let markdown = "";
  try {
    const res = await fetch(`${GATEWAY}/scrape`, {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lov}`,
        "X-Connection-Api-Key": fc,
      },
      body: JSON.stringify({ url: input.url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) {
      console.error(`Web profile read failed [${res.status}]`);
      const msg =
        res.status === 402
          ? "The web reading service has run out of credits."
          : res.status === 429
            ? "The web reading service is busy. Please try again shortly."
            : input.label === "linkedin"
              ? "LinkedIn did not allow this page to be read. Copy your profile text and use Paste text instead."
              : "This page could not be read. Check the link is public, or paste the text instead.";
      return fail(name, input.label, msg);
    }
    const body = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
    markdown = (body.data?.markdown ?? body.markdown ?? "").trim();
  } catch (error) {
    const aborted = (error as { name?: string })?.name === "AbortError";
    return fail(
      name,
      input.label,
      aborted ? "Reading this link was cancelled." : "This page could not be reached.",
    );
  }
  if (markdown.length < 80 || (input.label === "linkedin" && AUTH_WALL.test(markdown.slice(0, 3000)))) {
    return fail(
      name,
      input.label,
      input.label === "linkedin"
        ? "LinkedIn showed a sign-in page instead of your profile, so nothing was read. Copy your profile text and use Paste text instead."
        : "This page had no readable profile text. Paste the text instead.",
    );
  }
  return extractProfileDocument(
    { name, label: input.label, mimeType: "text/plain", content: markdown.slice(0, MAX_CHARS) },
    signal,
    runId,
  );
}
