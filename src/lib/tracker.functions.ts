// Database-backed application tracker. Every function acts as the signed-in
// user; row-level security limits each user to their own rows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TRACKER_STATUSES = [
  "saved",
  "preparing",
  "submitted",
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
