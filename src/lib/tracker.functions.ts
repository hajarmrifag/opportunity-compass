// Database-backed application tracker. Every function acts as the signed-in
// user; row-level security limits each user to their own rows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TRACKER_STATUSES = [
  "saved",
  "preparing",
  "submitted",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const TRACKER_SOURCES = ["referral", "cold", "career_fair", "other"] as const;
export type TrackerSource = (typeof TRACKER_SOURCES)[number];

export interface TrackerApplication {
  id: string;
  listing_id: string;
  company: string;
  role: string;
  status: TrackerStatus;
  source: TrackerSource;
  applied_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TrackerEvent {
  id: string;
  application_id: string;
  status: TrackerStatus;
  date: string;
  source: "manual" | "gmail";
}

export interface Resource {
  id: string;
  title: string;
  url: string | null;
  tag: string;
  notes: string;
  created_at: string;
}

// Tables are created by the staged migration, so the generated Database types
// do not know them yet; cast the client and validate shapes on our side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export const listTrackerApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrackerApplication[]> => {
    const { data, error } = await (context.supabase as AnyClient)
      .from("applications")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TrackerApplication[];
  });

export const saveToTracker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        listingId: z.string().min(1),
        company: z.string().min(1),
        role: z.string().min(1),
        source: z.enum(TRACKER_SOURCES).default("other"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ created: boolean; id: string }> => {
    const supabase = context.supabase as AnyClient;
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("listing_id", data.listingId)
      .maybeSingle();
    if (existing) return { created: false, id: existing.id as string };

    const { data: row, error } = await supabase
      .from("applications")
      .insert({
        listing_id: data.listingId,
        company: data.company,
        role: data.role,
        status: "saved",
        source: data.source,
      })
      .select("id")
      .single();
    if (error) {
      // Unique violation = another tab saved first; treat as already saved.
      if (error.code === "23505") return { created: false, id: "" };
      throw new Error(error.message);
    }
    await supabase.from("application_events").insert({
      application_id: row.id,
      status: "saved",
      source: "manual",
    });
    return { created: true, id: row.id as string };
  });

export const updateTrackerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(TRACKER_STATUSES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyClient;
    const { error } = await supabase
      .from("applications")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: data.id,
      status: data.status,
      source: "manual",
    });
    if (eventError) throw new Error(eventError.message);
    return { ok: true };
  });

export const updateTrackerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        notes: z.string().max(5000).optional(),
        source: z.enum(TRACKER_SOURCES).optional(),
        applied_date: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as AnyClient)
      .from("applications")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTrackerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("applications")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrackerEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ applicationId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<TrackerEvent[]> => {
    const { data: rows, error } = await (context.supabase as AnyClient)
      .from("application_events")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TrackerEvent[];
  });

// --- Resources (shared curated list; RLS: everyone signed in reads, admins write) ---

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Resource[]> => {
    const { data, error } = await (context.supabase as AnyClient)
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Resource[];
  });

export const saveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        url: z.string().url().nullable().optional(),
        tag: z.string().max(60).default(""),
        notes: z.string().max(2000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyClient;
    const { id, ...fields } = data;
    const query = id
      ? supabase.from("resources").update(fields).eq("id", id)
      : supabase.from("resources").insert(fields);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("resources")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await (context.supabase as AnyClient)
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  });

// --- Coffee chats ---

export const COFFEE_CHAT_OUTCOMES = [
  "planned",
  "responded",
  "ghosted",
  "follow_up_ghosted",
  "successful_referral",
] as const;
export type CoffeeChatOutcome = (typeof COFFEE_CHAT_OUTCOMES)[number];

export interface CoffeeChat {
  id: string;
  contact_name: string;
  company: string;
  date: string | null;
  follow_up_date: string | null;
  notes: string;
  outcome: "" | CoffeeChatOutcome;
  referral: boolean | null;
  created_at: string;
}

export const listCoffeeChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoffeeChat[]> => {
    const { data, error } = await (context.supabase as AnyClient)
      .from("coffee_chats")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CoffeeChat[];
  });

export const saveCoffeeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        contact_name: z.string().min(1).max(200),
        company: z.string().max(200).default(""),
        date: z.string().nullable().optional(),
        follow_up_date: z.string().nullable().optional(),
        notes: z.string().max(5000).default(""),
        outcome: z.enum(["", ...COFFEE_CHAT_OUTCOMES]).default(""),
        referral: z.boolean().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyClient;
    const { id, ...fields } = data;
    const query = id
      ? supabase.from("coffee_chats").update(fields).eq("id", id)
      : supabase.from("coffee_chats").insert(fields);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCoffeeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("coffee_chats")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Email suggestions (Gmail scan proposals; nothing is applied until accepted) ---

export interface EmailSuggestion {
  id: string;
  kind: "application" | "coffee_chat";
  gmail_message_id: string;
  company: string | null;
  role: string | null;
  email_type: string | null;
  event_datetime: string | null;
  confidence: number | null;
  evidence: string | null;
  state: "pending" | "accepted" | "dismissed";
  created_at: string;
}

export const listEmailSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailSuggestion[]> => {
    const { data, error } = await (context.supabase as AnyClient)
      .from("email_suggestions")
      .select("*")
      .eq("state", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EmailSuggestion[];
  });

export const updateEmailSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), state: z.enum(["accepted", "dismissed"]) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("email_suggestions")
      .update({ state: data.state })
      .eq("id", data.id)
      .eq("state", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Gmail scanning needs each student to connect their own mailbox, which
// requires the workspace Google sign-in registration. Until that exists,
// report honestly instead of pretending to scan.
export const scanGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ connected: boolean; message: string; found: number }> => {
    return {
      connected: false,
      message:
        "Gmail connection is not set up yet. Once it is, scanning will propose status updates here for you to accept or dismiss — nothing changes automatically.",
      found: 0,
    };
  });

// --- AI advice: counts computed from the database, suggestions from resources ---

export interface AdviceResult {
  advice: string;
  resources: Resource[];
}

export const generateAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdviceResult> => {
    const supabase = context.supabase as AnyClient;
    const [{ data: apps }, { data: chats }, { data: resources }] = await Promise.all([
      supabase.from("applications").select("status"),
      supabase.from("coffee_chats").select("outcome, date"),
      supabase.from("resources").select("*"),
    ]);
    const stats = {
      applications: (apps ?? []).reduce(
        (acc: Record<string, number>, a: { status: string }) => {
          acc[a.status] = (acc[a.status] ?? 0) + 1;
          return acc;
        },
        {},
      ),
      coffeeChats: (chats ?? []).reduce(
        (acc: Record<string, number>, c: { outcome: string }) => {
          const key = c.outcome || "planned";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
    };
    const allResources = (resources ?? []) as Resource[];

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        advice:
          "AI suggestions are not configured in this workspace yet. Your numbers above are still up to date.",
        resources: [],
      };
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const resourceList = allResources
      .map((r) => `- id:${r.id} | ${r.title} | tag:${r.tag} | ${r.notes}`)
      .join("\n");
    const prompt = `You are advising a student on their internship search. These are their real numbers, counted from their own records (never invent others): ${JSON.stringify(stats)}. Write 3-5 short, honest, encouraging sentences: what the numbers say, one concrete next step for applications, and one for coffee chats. Then, from this curated resource list, pick up to 3 that genuinely fit the situation (e.g. a course when many applications stall before interview, a coffee-chat workshop when chats are ghosted). Return ONLY JSON: {"advice":"...","resourceIds":["..."]}. If none fit, use an empty array. Resources:\n${resourceList || "(none)"}`;

    let advice = "";
    let picked: Resource[] = [];
    try {
      const result = await generateText({
        model: provider.responses("openai/gpt-6-astra"),
        prompt,
      });
      const parsed = JSON.parse(result.text.replace(/```json|```/g, "").trim()) as {
        advice?: string;
        resourceIds?: string[];
      };
      advice = (parsed.advice ?? "").trim();
      const ids = new Set(parsed.resourceIds ?? []);
      picked = allResources.filter((r) => ids.has(r.id));
    } catch {
      advice =
        "The AI suggestion could not be generated right now. Your numbers above are still accurate — try again in a moment.";
    }

    await supabase.from("advice_log").insert({
      stats,
      advice,
      resource_ids: picked.map((r) => r.id),
    });
    return { advice, resources: picked };
  });
