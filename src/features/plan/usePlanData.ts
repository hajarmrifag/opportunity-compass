import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ItemStatus, Notice, OpportunityPlanRef, ProgressEntry, Requirement, RequirementKind, Stage } from "./types";

const db = supabase as unknown as { from: (t: string) => any; auth: typeof supabase.auth; functions: typeof supabase.functions };

/** Shared, quote-backed requirements and notices for one opportunity. */
export function usePlanReference(opportunityId: string) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dates, setDates] = useState<{ applicationDeadline: string | null; startDate: string | null; applicationUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, n, d] = await Promise.all([
        db.from("plan_requirements").select("*").eq("opportunity_id", opportunityId),
        db.from("plan_notices").select("*").eq("opportunity_id", opportunityId),
        db.from("plan_opportunity_dates").select("*").eq("opportunity_id", opportunityId).maybeSingle(),
      ]);
      const err = [r, n, d].find((x) => x.error)?.error;
      if (err) throw err;
      setRequirements(
        (r.data ?? []).map((x: any) => ({
          id: x.id,
          opportunityId: x.opportunity_id,
          kind: x.kind,
          label: x.label,
          stage: x.stage,
          required: x.required,
          dueDate: x.due_date,
          dueRule: x.due_after ? { after: x.due_after, days: x.due_after_days ?? 0 } : null,
          evidenceQuote: x.evidence_quote,
          sourceUrl: x.source_url,
          source: x.source,
          status: x.status,
          note: x.note,
        })),
      );
      setNotices((n.data ?? []).map((x: any) => ({ id: x.id, opportunityId: x.opportunity_id, text: x.text, evidenceQuote: x.evidence_quote, sourceUrl: x.source_url })));
      setDates(d.data ? { applicationDeadline: d.data.application_deadline, startDate: d.data.start_date, applicationUrl: d.data.application_url ?? null } : null);
    } catch (e: any) {
      setError(e?.message ?? "Could not load application steps");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  return { requirements, notices, dates, loading, error, reload: load };
}

const localKey = (opportunityId: string) => `opportunityos.plan.${opportunityId}`;

interface LocalState {
  progress: ProgressEntry[];
  userRequirements: Requirement[];
}

/**
 * The student's own progress and the requirements they added from the application form.
 * Signed in: stored in plan_progress / plan_user_requirements (private to them).
 * Not signed in (demo): stored in this browser only.
 */
export function usePlanProgress(opportunity: OpportunityPlanRef) {
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [userRequirements, setUserRequirements] = useState<Requirement[]>([]);

  const readLocal = useCallback((): LocalState => {
    try {
      const raw = window.localStorage.getItem(localKey(opportunity.id));
      return raw ? JSON.parse(raw) : { progress: [], userRequirements: [] };
    } catch {
      return { progress: [], userRequirements: [] };
    }
  }, [opportunity.id]);

  const writeLocal = (state: LocalState) => {
    try {
      window.localStorage.setItem(localKey(opportunity.id), JSON.stringify(state));
    } catch {
      /* keep in memory */
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await db.auth.getUser();
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        const s = readLocal();
        setProgress(s.progress);
        setUserRequirements(s.userRequirements);
        return;
      }
      const [p, u] = await Promise.all([
        db.from("plan_progress").select("*").eq("opportunity_id", opportunity.id),
        db.from("plan_user_requirements").select("*").eq("opportunity_id", opportunity.id),
      ]);
      setProgress((p.data ?? []).map((x: any) => ({ itemKey: x.item_key, status: x.status, submittedAt: x.submitted_at, updatedAt: x.updated_at })));
      setUserRequirements(
        (u.data ?? []).map((x: any) => ({
          id: x.id, opportunityId: x.opportunity_id, kind: x.kind, label: x.label, stage: x.stage, required: x.required,
          dueDate: null, dueRule: null, evidenceQuote: null, sourceUrl: null, source: "student_added", status: "published",
        })),
      );
    })();
  }, [opportunity.id, readLocal]);

  const setStatus = useCallback(
    async (itemKey: string, status: ItemStatus) => {
      const today = new Date().toISOString().slice(0, 10);
      const entry: ProgressEntry = { itemKey, status, submittedAt: status === "submitted" ? today : null, updatedAt: new Date().toISOString() };
      const next = [...progress.filter((p) => p.itemKey !== itemKey), entry];
      setProgress(next);
      if (!userId) return writeLocal({ progress: next, userRequirements });
      await db.from("plan_progress").upsert(
        { user_id: userId, opportunity_id: opportunity.id, item_key: itemKey, status, submitted_at: entry.submittedAt, updated_at: entry.updatedAt },
        { onConflict: "user_id,opportunity_id,item_key" },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, userId, userRequirements, opportunity.id],
  );

  const addRequirement = useCallback(
    async (kind: RequirementKind, label: string, stage: Stage = "application") => {
      const local: Requirement = {
        id: `student-${Date.now()}`, opportunityId: opportunity.id, kind, label, stage, required: true,
        dueDate: null, dueRule: null, evidenceQuote: null, sourceUrl: null, source: "student_added", status: "published",
      };
      if (!userId) {
        const next = [...userRequirements, local];
        setUserRequirements(next);
        return writeLocal({ progress, userRequirements: next });
      }
      const { data } = await db
        .from("plan_user_requirements")
        .insert({ user_id: userId, opportunity_id: opportunity.id, kind, label, stage, required: true })
        .select()
        .single();
      setUserRequirements([...userRequirements, { ...local, id: data?.id ?? local.id }]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, userRequirements, progress, opportunity.id],
  );

  return { progress, userRequirements, setStatus, addRequirement, signedIn: userId !== null };
}

/** Calls the plan-documents server function. The CV is not stored. */
export async function requestDocumentHelp(
  action: "tailor_cv" | "cover_letter",
  cvText: string,
  opportunity: { title: string; organiser?: string; description?: string; requirements?: string[] },
) {
  const { data, error } = await db.functions.invoke("plan-documents", { body: { action, cv_text: cvText, opportunity } });
  if (error) throw new Error(error.message ?? "Document help is unavailable right now");
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Loads steps and progress for many saved opportunities at once (for the "Due soon" list and the reminder bell).
 * Pass the student's saved opportunities with their tracker state.
 */
export function useMultiPlanData(saved: Array<{ opportunity: OpportunityPlanRef; tracker: import("./types").TrackerState }>) {
  const [state, setState] = useState<{
    requirements: Requirement[];
    progress: Array<ProgressEntry & { opportunityId: string }>;
    dates: Record<string, { applicationDeadline: string | null; startDate: string | null; applicationUrl: string | null }>;
  }>({ requirements: [], progress: [], dates: {} });
  const [loading, setLoading] = useState(false);
  const ids = saved.map((s) => s.opportunity.id);
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) return;
    (async () => {
      setLoading(true);
      const { data: auth } = await db.auth.getUser();
      const uid = auth?.user?.id ?? null;
      const [r, d, p, u] = await Promise.all([
        db.from("plan_requirements").select("*").in("opportunity_id", ids),
        db.from("plan_opportunity_dates").select("*").in("opportunity_id", ids),
        uid ? db.from("plan_progress").select("*").in("opportunity_id", ids) : Promise.resolve({ data: [] }),
        uid ? db.from("plan_user_requirements").select("*").in("opportunity_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const mapReq = (x: any): Requirement => ({
        id: x.id, opportunityId: x.opportunity_id, kind: x.kind, label: x.label, stage: x.stage, required: x.required,
        dueDate: x.due_date ?? null, dueRule: x.due_after ? { after: x.due_after, days: x.due_after_days ?? 0 } : null,
        evidenceQuote: x.evidence_quote ?? null, sourceUrl: x.source_url ?? null, source: x.source ?? "student_added", status: x.status ?? "published",
      });
      let requirements = [...(r.data ?? []).map(mapReq), ...(u.data ?? []).map((x: any) => mapReq({ ...x, source: "student_added" }))];
      let progress = (p.data ?? []).map((x: any) => ({ opportunityId: x.opportunity_id, itemKey: x.item_key, status: x.status, submittedAt: x.submitted_at }));
      if (!uid) {
        // Signed out: read what each plan saved in this browser.
        for (const oppId of ids) {
          try {
            const raw = window.localStorage.getItem(localKey(oppId));
            if (!raw) continue;
            const local = JSON.parse(raw) as LocalState;
            requirements = [...requirements, ...local.userRequirements];
            progress = [...progress, ...local.progress.map((x) => ({ ...x, opportunityId: oppId }))];
          } catch {
            /* ignore */
          }
        }
      }
      const dates: Record<string, any> = {};
      for (const x of d.data ?? [])
        dates[x.opportunity_id] = { applicationDeadline: x.application_deadline, startDate: x.start_date, applicationUrl: x.application_url ?? null };
      setState({ requirements, progress, dates });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, loading };
}
