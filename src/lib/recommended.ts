// Client-safe, pure logic for the Recommended page: which categories exist, how a
// confirmed Passport becomes non-identifying search hints, and the response contract.
// Nothing here calls the network. Only non-identifying profile facts may leave the
// browser: degree level, field, a few skills, languages and the remote preference.
// Never name, email, free-form goals, CV text or notes.
import { z } from "zod";
import type { Category, Profile } from "@/domain/types";
import { CATEGORY_LABELS, DEGREE_LABELS } from "@/domain/types";
import type { AgentSearchError, AgentSearchResponse } from "./agentSearch";

export const RECOMMENDED_CATEGORIES = [
  "internship",
  "job",
  "masters",
  "fellowship",
  "scholarship",
] as const satisfies readonly Category[];
export type RecommendedCategory = (typeof RECOMMENDED_CATEGORIES)[number];

export const RECOMMENDED_MODEL = "google/gemini-3.8-flash";
/** Fallback when the primary model is unavailable; the existing agent model. */
export const RECOMMENDED_FALLBACK_MODEL = "openai/gpt-6-astra";

/** Non-identifying hints derived from the confirmed Passport. */
export interface ProfileHints {
  degreeLevel: string; // human label or ""
  field: string;
  skills: string[]; // max 6
  languages: string[]; // max 4
  remoteOk: boolean;
}

export function profileHints(profile: Profile | null): ProfileHints {
  if (!profile) return { degreeLevel: "", field: "", skills: [], languages: [], remoteOk: false };
  return {
    degreeLevel: profile.degreeLevel ? DEGREE_LABELS[profile.degreeLevel] : "",
    field: profile.field.trim().slice(0, 80),
    skills: profile.skills
      .map((s) => s.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 6),
    languages: profile.languages
      .map((l) => l.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 4),
    remoteOk: profile.preferences.remoteOk === true,
  };
}

/** True when the hints carry enough to write a useful query. */
export function hintsUsable(h: ProfileHints): boolean {
  return Boolean(h.field || h.skills.length || h.degreeLevel);
}

export const recommendedInput = z.object({
  category: z.enum(RECOMMENDED_CATEGORIES),
  hints: z.object({
    degreeLevel: z.string().max(30).default(""),
    field: z.string().max(80).default(""),
    skills: z.array(z.string().max(40)).max(6).default([]),
    languages: z.array(z.string().max(30)).max(4).default([]),
    remoteOk: z.boolean().default(false),
  }),
});
export type RecommendedInput = z.infer<typeof recommendedInput>;

/** The free-text request the agent plans from, per category. No personal data. */
export function categoryRequest(category: RecommendedCategory, h: ProfileHints): string {
  const label = CATEGORY_LABELS[category];
  const parts = [`Find current ${label.toLowerCase()} opportunities`];
  if (h.field) parts.push(`in ${h.field}`);
  if (h.skills.length) parts.push(`for someone skilled in ${h.skills.slice(0, 3).join(", ")}`);
  if (h.degreeLevel) parts.push(`open to ${h.degreeLevel} students or graduates`);
  return parts.join(" ").slice(0, 200);
}

export interface RecommendedResponse {
  ok: true;
  category: RecommendedCategory;
  search: AgentSearchResponse;
}

export type RecommendedError = AgentSearchError;
export type RecommendedResult = RecommendedResponse | { ok: false; error: RecommendedError };
