// Versioned browser-local repository. Swap for a remote repository later.
import type { Application, Opportunity, Profile } from "@/domain/types";

export const STORAGE_KEY = "opportunityos";
export const STORAGE_VERSION = 3;
export const COMPARE_LIMIT = 3;

export function normalizeCompareIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0)),
  ].slice(0, COMPARE_LIMIT);
}

export function toggleCompareIds(ids: string[], opportunityId: string) {
  if (ids.includes(opportunityId)) {
    return { ids: ids.filter((id) => id !== opportunityId), ok: true };
  }
  if (ids.length >= COMPARE_LIMIT) return { ids, ok: false };
  return { ids: [...ids, opportunityId], ok: true };
}

export interface PersistedState {
  version: number;
  profile: Profile | null;
  applications: Application[];
  customOpportunities: Opportunity[];
  compareIds: string[];
  profileDraft: Profile | null;
}

export const emptyState = (): PersistedState => ({
  version: STORAGE_VERSION,
  profile: null,
  applications: [],
  customOpportunities: [],
  compareIds: [],
  profileDraft: null,
});

export function normalizeProfile(profile: Profile | null | undefined): Profile | null {
  if (!profile) return null;
  const legacy = profile as Profile & { graduationYear?: number | null };
  return {
    ...profile,
    education: Array.isArray(profile.education)
      ? profile.education
      : profile.degreeLevel || profile.field
        ? [
            {
              id: "legacy-education",
              degreeLevel: profile.degreeLevel,
              degreeName: "",
              school: "",
              field: profile.field,
            },
          ]
        : [],
    gpaValue: profile.gpaValue ?? "",
    gpaScale: profile.gpaScale ?? "",
    graduationDate:
      profile.graduationDate ?? (legacy.graduationYear ? String(legacy.graduationYear) : null),
    graduationDatePrecision:
      profile.graduationDatePrecision ?? (legacy.graduationYear ? "year" : null),
    languageDetails: Array.isArray(profile.languageDetails)
      ? profile.languageDetails
      : (profile.languages ?? []).map((name) => ({ name, level: "" })),
    constraints: Array.isArray(profile.constraints) ? profile.constraints : [],
    fieldProvenance: profile.fieldProvenance ?? {},
    sourceDocuments: Array.isArray(profile.sourceDocuments) ? profile.sourceDocuments : [],
    fieldEvidence: Array.isArray(profile.fieldEvidence) ? profile.fieldEvidence : [],
    workExperience: Array.isArray(profile.workExperience) ? profile.workExperience : [],
  };
}

export interface Repository {
  load(): { state: PersistedState; error: string | null };
  save(state: PersistedState): string | null;
  clear(): void;
}

export const localRepository: Repository = {
  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { state: emptyState(), error: null };
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== STORAGE_VERSION) {
        return {
          state: emptyState(),
          error: `Saved data used an unsupported version (${String(parsed.version)}). Starting fresh.`,
        };
      }
      return {
        state: {
          version: STORAGE_VERSION,
          profile: normalizeProfile(parsed.profile),
          applications: Array.isArray(parsed.applications)
            ? parsed.applications.map((application) => ({
                ...application,
                tasks: Array.isArray(application.tasks) ? application.tasks : [],
              }))
            : [],
          customOpportunities: Array.isArray(parsed.customOpportunities)
            ? parsed.customOpportunities
            : [],
          compareIds: normalizeCompareIds(parsed.compareIds),
          profileDraft: normalizeProfile(parsed.profileDraft),
        },
        error: null,
      };
    } catch {
      return { state: emptyState(), error: "Saved data could not be read. Starting fresh." };
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return null;
    } catch {
      return "Could not save to this browser (storage may be full or blocked).";
    }
  },
  clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
