import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, CvChange, CvDocument, Fact } from "./types";

const fn = supabase.functions;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await fn.invoke("cv-assistant", { body });
  if (error) throw new Error(error.message ?? "The CV assistant is unavailable right now.");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/** Structures uploaded CV text. Returns null if the AI could not copy the text exactly (use cvFromPlainText instead). */
export async function parseCv(text: string): Promise<CvDocument | null> {
  const res = await call<{ doc: CvDocument | null }>({ action: "parse_cv", text });
  return res.doc;
}

export interface ChatResult {
  reply: string;
  changes: CvChange[];
  newFacts: Array<{ text: string; quote: string }>;
  gaps: Array<{ requirement: string; question?: string }>;
}

export async function chatAboutCv(args: {
  cv: CvDocument;
  facts: Fact[];
  opportunity: { title: string; organiser?: string; description?: string; requirements?: string[] };
  messages: ChatMessage[];
  mode: "tailor" | "build";
}): Promise<ChatResult> {
  const res = await call<{ reply: string; changes: CvChange[]; new_facts: ChatResult["newFacts"]; gaps: ChatResult["gaps"] }>({
    action: "chat",
    ...args,
  });
  return { reply: res.reply, changes: res.changes ?? [], newFacts: res.new_facts ?? [], gaps: res.gaps ?? [] };
}

export interface OfferAnalysis {
  summary: string;
  lookingFor: Array<{ point: string; quote: string }>;
  documents: Array<{ kind: string; quote: string }>;
  keywords: string[];
  pageText: string;
  sourceUrl: string;
}

/** Reads the opportunity's official page and lists what the employer asks for, each point backed by a quote. */
export async function analyzeOffer(url: string, title: string): Promise<OfferAnalysis> {
  const res = await call<{
    summary: string;
    looking_for: OfferAnalysis["lookingFor"];
    documents: OfferAnalysis["documents"];
    keywords: string[];
    page_text: string;
    source_url: string;
  }>({ action: "analyze_offer", url, title });
  return {
    summary: res.summary ?? "",
    lookingFor: res.looking_for ?? [],
    documents: res.documents ?? [],
    keywords: res.keywords ?? [],
    pageText: res.page_text ?? "",
    sourceUrl: res.source_url ?? url,
  };
}
