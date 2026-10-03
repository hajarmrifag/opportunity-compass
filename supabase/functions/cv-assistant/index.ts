// Supabase Edge Function (Deno): CV studio assistant.
//   action "analyze_offer": reads the opportunity's official page and says what the employer asks for (quote-verified).
//   action "parse_cv": turns uploaded CV text into sections/entries/bullets, copying text exactly (verified).
//   action "chat":     proposes changes for one opportunity and answers the student, facts only.
// The browser re-checks every proposed change (src/features/cv/cvModel.ts checkChange) before it can be accepted.
// Nothing is stored here.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const AI_URL = Deno.env.get("AI_GATEWAY_URL") ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "google/gemini-2.5-flash";

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[•\u2022]/g, " ").replace(/\s+/g, " ").trim();
let n = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;

async function ai(system: string, messages: Array<{ role: string; content: string }>) {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (res.status === 429) throw new Error("The AI is busy. Try again in a minute.");
  if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const body = await res.json();
  return JSON.parse(String(body?.choices?.[0]?.message?.content ?? "{}").replace(/