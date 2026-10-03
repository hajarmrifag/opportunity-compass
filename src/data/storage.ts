// Versioned browser-local repository. Swap for a remote repository later.
import type { Application, Opportunity, Profile } from "@/domain/types";

export const STORAGE_KEY = "opportunityos";
export const STORAGE_VERSION = 1;

export interface PersistedState {
  version: number;
  profile: Profile | null;
  applications: Application[];
  customOpportunities: Opportunity[];
}

export const emptyState = (): PersistedState => ({
  version: STORAGE_VERSION,
  profile: null,
  applications: [],
  customOpportunities: [],
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
      if (parsed.version !== STORAGE_VERSION) {
        return { state: emptyState(), error: `Saved data used an unsupported version (${String(parsed.version)}). Starting fresh.` };
      }
      return {
        state: {
          version: STORAGE_VERSION,
          profile: parsed.profile ?? null,
          applications: Array.isArray(parsed.applications) ? parsed.applications : [],
          customOpportunities: Array.isArray(parsed.customOpportunities) ? parsed.customOpportunities : [],
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
