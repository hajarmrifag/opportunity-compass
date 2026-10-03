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
