import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Application, ApplicationStatus, Opportunity, Profile } from "@/domain/types";
import { DEMO_OPPORTUNITIES, DEMO_PROFILE } from "@/data/fixtures";
import { emptyState, localRepository, type PersistedState } from "@/data/storage";
import { deadlineState } from "./validation";

interface Store {
  ready: boolean;
  error: string | null;
  dismissError: () => void;
  profile: Profile | null;
  opportunities: Opportunity[];
  applications: Application[];
  getOpportunity: (id: string) => Opportunity | undefined;
  getApplication: (oppId: string) => Application | undefined;
  saveProfile: (p: Profile) => void;
  loadDemoProfile: () => void;
  saveOpportunity: (oppId: string) => Application;
  updateApplication: (id: string, patch: Partial<Pick<Application, "status" | "notes" | "deadline">>) => void;
  removeApplication: (id: string) => void;
  addManualOpportunity: (opp: Opportunity) => void;
  importTracker: (plan: ImportPlanItem[]) => void;
  resetAll: () => void;
}

/** One confirmed CSV import row, already validated. Applied in a single atomic commit. */
export type ImportPlanItem =
  | { kind: "create"; opp: Opportunity; status: ApplicationStatus; notes: string; deadline: string | null }
  | { kind: "track"; oppId: string; status: ApplicationStatus; notes: string; deadline: string | null }
  | { kind: "update"; appId: string; status: ApplicationStatus; notes: string; deadline: string | null };

// Keep one context object across hot reloads: when this module is re-evaluated, a fresh
// createContext() would make consumers and the already-mounted provider disagree.
const g = globalThis as typeof globalThis & { __opportunityOsStoreCtx?: ReturnType<typeof createContext<Store | null>> };
const Ctx = (g.__opportunityOsStoreCtx ??= createContext<Store | null>(null));
const now = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(emptyState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { state: s, error: e } = localRepository.load();
    setState(s);
    setError(e);
    setReady(true);
  }, []);

  const commit = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setState((prev) => {
      const next = fn(prev);
      const e = localRepository.save(next);
      if (e) setError(e);
      return next;
    });
  }, []);

  const opportunities = useMemo(() => [...DEMO_OPPORTUNITIES, ...state.customOpportunities], [state.customOpportunities]);

  const store: Store = {
    ready,
    error,
    dismissError: () => setError(null),
    profile: state.profile,
    opportunities,
    applications: state.applications,
    getOpportunity: (id) => opportunities.find((o) => o.id === id),
    getApplication: (oppId) => state.applications.find((a) => a.opportunityId === oppId),
    saveProfile: (p) => commit((s) => ({ ...s, profile: p })),
    loadDemoProfile: () => commit((s) => ({ ...s, profile: { ...DEMO_PROFILE } })),
    saveOpportunity: (oppId) => {
      const existing = state.applications.find((a) => a.opportunityId === oppId);
      if (existing) return existing;
      const t = now();
      const app: Application = {
        id: uid(), opportunityId: oppId, status: "saved", notes: "", deadline: null,
        createdAt: t, updatedAt: t, history: [{ status: "saved", at: t }],
      };
      // Idempotent even under rapid double-clicks: re-check inside updater.
      commit((s) => (s.applications.some((a) => a.opportunityId === oppId) ? s : { ...s, applications: [...s.applications, app] }));
      return app;
    },
    updateApplication: (id, patch) =>
      commit((s) => ({
        ...s,
        applications: s.applications.map((a) => {
          if (a.id !== id) return a;
          const t = now();
          const statusChanged = patch.status && patch.status !== a.status;
          return {
            ...a, ...patch, updatedAt: t,
            history: statusChanged ? [...a.history, { status: patch.status as ApplicationStatus, at: t }] : a.history,
          };
        }),
      })),
    removeApplication: (id) => commit((s) => ({ ...s, applications: s.applications.filter((a) => a.id !== id) })),
    addManualOpportunity: (opp) => commit((s) => ({ ...s, customOpportunities: [...s.customOpportunities, opp] })),
    importTracker: (plan) =>
      commit((s) => {
        const t = now();
        let apps = [...s.applications];
        const custom = [...s.customOpportunities];
        const mk = (oppId: string, p: ImportPlanItem): Application => ({
          id: uid(), opportunityId: oppId, status: p.status, notes: p.notes, deadline: p.deadline,
          createdAt: t, updatedAt: t, history: [{ status: p.status, at: t }],
        });
        for (const p of plan) {
          if (p.kind === "create") {
            custom.push(p.opp);
            apps.push(mk(p.opp.id, p));
          } else if (p.kind === "track") {
            if (!apps.some((a) => a.opportunityId === p.oppId)) apps.push(mk(p.oppId, p));
          } else {
            apps = apps.map((a) =>
              a.id !== p.appId ? a : {
                ...a, status: p.status, notes: p.notes || a.notes, deadline: p.deadline ?? a.deadline, updatedAt: t,
                history: p.status !== a.status ? [...a.history, { status: p.status, at: t }] : a.history,
              });
          }
        }
        return { ...s, applications: apps, customOpportunities: custom };
      }),
    resetAll: () => {
      localRepository.clear();
      setState(emptyState());
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

export function daysUntil(iso: string | null): number | null {
  return deadlineState(iso).days;
}

export function effectiveDeadline(app: Application | undefined, opp: Opportunity | undefined) {
  return app?.deadline || opp?.deadline || null;
}
