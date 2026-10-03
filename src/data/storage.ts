// Versioned browser-local repository. Swap for a remote repository later.
import type { Application, Opportunity, Profile } from "@/domain/types";

export const STORAGE_KEY = "opportunityos";
export const STORAGE_VERSION = 2;
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
}

export const emptyState = (): PersistedState => ({
  version: STORAGE_VERSION,
  profile: null,
  applications: [],
  customOpportunities: [],
  compareIds: [],
});

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
      if (parsed.version !== 1 && parsed.version !== STORAGE_VERSION) {
        return {
          state: emptyState(),
          error: `Saved data used an unsupported version (${String(parsed.version)}). Starting fresh.`,
        };
      }
      return {
        state: {
          version: STORAGE_VERSION,
          profile: parsed.profile ?? null,
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
