import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ActionTask,
  Application,
  ApplicationStatus,
  Opportunity,
  Profile,
} from "@/domain/types";
import { DEMO_OPPORTUNITIES, DEMO_PROFILE } from "@/data/fixtures";
import { emptyState, localRepository, toggleCompareIds, type PersistedState } from "@/data/storage";
import { deadlineState } from "./validation";

interface Store {
  ready: boolean;
  error: string | null;
  dismissError: () => void;
  profile: Profile | null;
  opportunities: Opportunity[];
  applications: Application[];
  compareIds: string[];
  getOpportunity: (id: string) => Opportunity | undefined;
  getApplication: (oppId: string) => Application | undefined;
  saveProfile: (p: Profile) => void;
  loadDemoProfile: () => void;
  saveOpportunity: (oppId: string) => Application;
  updateApplication: (
    id: string,
    patch: Partial<Pick<Application, "status" | "notes" | "deadline">>,
  ) => void;
  removeApplication: (id: string) => void;
  addManualOpportunity: (opp: Opportunity) => void;
  importTracker: (plan: ImportPlanItem[]) => void;
  toggleCompare: (oppId: string) => { ok: boolean; message?: string };
  removeCompare: (oppId: string) => void;
  clearCompare: () => void;
  addTask: (
    applicationId: string,
    task: Pick<ActionTask, "label" | "dueDate" | "suggested">,
  ) => void;
  updateTask: (
    applicationId: string,
    taskId: string,
    patch: Partial<Pick<ActionTask, "label" | "completed" | "dueDate">>,
  ) => void;
  removeTask: (applicationId: string, taskId: string) => void;
  addSuggestedTasks: (applicationId: string) => void;
  /** Unsaved Passport edits (in-memory only, never used for eligibility). null = no pending edits. */
  profileDraft: Profile | null;
  setProfileDraft: (p: Profile | null) => void;
  pendingProfileEdits: boolean;
  resetAll: () => void;
}

/** One confirmed CSV import row, already validated. Applied in a single atomic commit. */
export type ImportPlanItem =
  | {
      kind: "create";
      opp: Opportunity;
      status: ApplicationStatus;
      notes: string;
      deadline: string | null;
    }
  | {
      kind: "track";
      oppId: string;
      status: ApplicationStatus;
      notes: string;
      deadline: string | null;
    }
  | {
      kind: "update";
      appId: string;
      status: ApplicationStatus;
      notes: string;
      deadline: string | null;
    };

// Keep one context object across hot reloads: when this module is re-evaluated, a fresh
// createContext() would make consumers and the already-mounted provider disagree.
const g = globalThis as typeof globalThis & {
  __opportunityOsStoreCtx?: ReturnType<typeof createContext<Store | null>>;
};
const Ctx = (g.__opportunityOsStoreCtx ??= createContext<Store | null>(null));
const now = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(emptyState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);

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

  const opportunities = useMemo(
    () => [...DEMO_OPPORTUNITIES, ...state.customOpportunities],
    [state.customOpportunities],
  );

  const store: Store = {
    ready,
    error,
    dismissError: () => setError(null),
    profile: state.profile,
    opportunities,
    applications: state.applications,
    compareIds: state.compareIds,
    getOpportunity: (id) => opportunities.find((o) => o.id === id),
    getApplication: (oppId) => state.applications.find((a) => a.opportunityId === oppId),
    profileDraft,
    setProfileDraft,
    pendingProfileEdits: profileDraft !== null,
    saveProfile: (p) => {
      setProfileDraft(null);
      commit((s) => ({ ...s, profile: p }));
    },
    loadDemoProfile: () => {
      setProfileDraft(null);
      commit((s) => ({ ...s, profile: { ...DEMO_PROFILE } }));
    },
    saveOpportunity: (oppId) => {
      const existing = state.applications.find((a) => a.opportunityId === oppId);
      if (existing) return existing;
      const t = now();
      const app: Application = {
        id: uid(),
        opportunityId: oppId,
        status: "saved",
        notes: "",
        deadline: null,
        createdAt: t,
        updatedAt: t,
        history: [{ status: "saved", at: t }],
        tasks: [],
      };
      // Idempotent even under rapid double-clicks: re-check inside updater.
      commit((s) =>
        s.applications.some((a) => a.opportunityId === oppId)
          ? s
          : { ...s, applications: [...s.applications, app] },
      );
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
            ...a,
            ...patch,
            updatedAt: t,
            history: statusChanged
              ? [...a.history, { status: patch.status as ApplicationStatus, at: t }]
              : a.history,
          };
        }),
      })),
    removeApplication: (id) =>
      commit((s) => ({ ...s, applications: s.applications.filter((a) => a.id !== id) })),
    addManualOpportunity: (opp) =>
      commit((s) => ({ ...s, customOpportunities: [...s.customOpportunities, opp] })),
    importTracker: (plan) =>
      commit((s) => {
        const t = now();
        let apps = [...s.applications];
        const custom = [...s.customOpportunities];
        const mk = (oppId: string, p: ImportPlanItem): Application => ({
          id: uid(),
          opportunityId: oppId,
          status: p.status,
          notes: p.notes,
          deadline: p.deadline,
          createdAt: t,
          updatedAt: t,
          history: [{ status: p.status, at: t }],
          tasks: [],
        });
        for (const p of plan) {
          if (p.kind === "create") {
            custom.push(p.opp);
            apps.push(mk(p.opp.id, p));
          } else if (p.kind === "track") {
            if (!apps.some((a) => a.opportunityId === p.oppId)) apps.push(mk(p.oppId, p));
          } else {
            apps = apps.map((a) =>
              a.id !== p.appId
                ? a
                : {
                    ...a,
                    status: p.status,
                    notes: p.notes || a.notes,
                    deadline: p.deadline ?? a.deadline,
                    updatedAt: t,
                    history:
                      p.status !== a.status
                        ? [...a.history, { status: p.status, at: t }]
                        : a.history,
                  },
            );
          }
        }
        return { ...s, applications: apps, customOpportunities: custom };
      }),
    toggleCompare: (oppId) => {
      const result = toggleCompareIds(state.compareIds, oppId);
      if (!result.ok)
        return {
          ok: false,
          message: "Compare is limited to 3 opportunities. Remove one to add another.",
        };
      commit((s) => ({ ...s, compareIds: toggleCompareIds(s.compareIds, oppId).ids }));
      return result;
    },
    removeCompare: (oppId) =>
      commit((s) => ({ ...s, compareIds: s.compareIds.filter((id) => id !== oppId) })),
    clearCompare: () => commit((s) => ({ ...s, compareIds: [] })),
    addTask: (applicationId, task) =>
      commit((s) => ({
        ...s,
        applications: s.applications.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                tasks: [
                  ...application.tasks,
                  {
                    id: uid(),
                    label: task.label.trim(),
                    dueDate: task.dueDate,
                    suggested: task.suggested,
                    completed: false,
                    createdAt: now(),
                  },
                ],
                updatedAt: now(),
              }
            : application,
        ),
      })),
    updateTask: (applicationId, taskId, patch) =>
      commit((s) => ({
        ...s,
        applications: s.applications.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                tasks: application.tasks.map((task) =>
                  task.id === taskId ? { ...task, ...patch } : task,
                ),
                updatedAt: now(),
              }
            : application,
        ),
      })),
    removeTask: (applicationId, taskId) =>
      commit((s) => ({
        ...s,
        applications: s.applications.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                tasks: application.tasks.filter((task) => task.id !== taskId),
                updatedAt: now(),
              }
            : application,
        ),
      })),
    addSuggestedTasks: (applicationId) => {
      const labels = [
        "Verify requirements",
        "Verify funding",
        "Prepare documents",
        "Submit via official site",
      ];
      commit((s) => ({
        ...s,
        applications: s.applications.map((application) => {
          if (application.id !== applicationId) return application;
          const existing = new Set(application.tasks.map((task) => task.label.toLowerCase()));
          const tasks = labels
            .filter((label) => !existing.has(label.toLowerCase()))
            .map((label) => ({
              id: uid(),
              label,
              completed: false,
              dueDate: null,
              suggested: true,
              createdAt: now(),
            }));
          return { ...application, tasks: [...application.tasks, ...tasks], updatedAt: now() };
        }),
      }));
    },
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
