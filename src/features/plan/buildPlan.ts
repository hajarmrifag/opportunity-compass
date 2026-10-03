import type {
  ItemStatus,
  PlanInput,
  PlanItem,
  PlanResult,
  Requirement,
  Stage,
  StageSummary,
  TrackerStatus,
} from "./types";

export const STAGES: Stage[] = ["application", "assessment", "interview", "after_offer"];

const STAGE_NAMES: Record<Stage, string> = {
  application: "Application",
  assessment: "Assessment",
  interview: "Interview",
  after_offer: "After an offer",
};

/** Which stages are open for each tracker status. Later stages stay locked until the student reaches them. */
const UNLOCKED: Record<TrackerStatus, Stage[]> = {
  saved: ["application"],
  preparing: ["application"],
  submitted: ["application", "assessment"],
  assessment: ["application", "assessment"],
  interview: ["application", "assessment", "interview"],
  offer: STAGES,
  accepted: STAGES,
  rejected: [],
  withdrawn: [],
};

const LOCK_REASON: Record<Stage, string> = {
  application: "",
  assessment: "Unlocks after you submit your application",
  interview: "Unlocks when you are invited to interview",
  after_offer: "Unlocks if you receive an offer",
};

const DOC_TOOLS: Partial<Record<Requirement["kind"], "cv" | "cover_letter">> = {
  cv: "cv",
  cover_letter: "cover_letter",
};

const DONE: ItemStatus[] = ["submitted", "not_needed"];

export const isDone = (s: ItemStatus) => DONE.includes(s);

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function resolveDue(req: Requirement, input: PlanInput): { date: string | null; label: string | null } {
  if (req.dueDate) return { date: req.dueDate, label: null };
  if (req.dueRule) {
    const { after, days } = req.dueRule;
    const anchor =
      after === "submitted" ? input.tracker.submittedAt : after === "invited" ? input.tracker.invitedAt : input.tracker.offerAt;
    const what = after === "submitted" ? "submitting" : after === "invited" ? "being invited" : "receiving an offer";
    const label = `Within ${days} day${days === 1 ? "" : "s"} of ${what}`;
    return { date: anchor ? addDays(anchor, days) : null, label };
  }
  // Application-stage items without their own date inherit the application deadline.
  if (req.stage === "application" && input.opportunity.applicationDeadline)
    return { date: input.opportunity.applicationDeadline, label: null };
  return { date: null, label: null };
}

/**
 * Builds the application checklist. Pure: no network, no clock (today is passed in).
 * Partial progress is tracked per item, so "CV submitted, cover letter not started" is represented exactly.
 */
export function buildPlan(input: PlanInput): PlanResult {
  const unlocked = new Set(UNLOCKED[input.tracker.status]);
  const closed = input.tracker.status === "rejected" || input.tracker.status === "withdrawn";
  const progress = new Map(input.progress.map((p) => [p.itemKey, p]));

  const items: PlanItem[] = [];

  for (const r of input.requirements) {
    const key = `req:${r.id}`;
    const due = resolveDue(r, input);
    items.push(makeItem(input, unlocked, closed, progress.get(key)?.status ?? "not_started", {
      key,
      label: r.label,
      kind: r.kind,
      stage: r.stage,
      required: r.required,
      dueDate: due.date,
      dueLabel: due.label,
      source: r.source,
      reviewStatus: r.status,
      evidenceQuote: r.evidenceQuote,
      sourceUrl: r.sourceUrl,
      note: r.note ?? null,
      tool: DOC_TOOLS[r.kind] ?? null,
    }));
  }

  for (const m of input.moneySteps) {
    items.push(makeItem(input, unlocked, closed, progress.get(m.key)?.status ?? "not_started", {
      key: m.key,
      label: m.label,
      kind: "money",
      stage: m.stage,
      required: m.required,
      dueDate: m.dueDate,
      dueLabel: null,
      source: "money_check",
      reviewStatus: null,
      evidenceQuote: null,
      sourceUrl: m.sourceUrl ?? null,
      note: m.note ?? null,
      tool: null,
    }));
  }

  // Order: stage, then due date (undated last), then required first.
  items.sort((a, b) => {
    const s = STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
    if (s !== 0) return s;
    if (a.dueDate !== b.dueDate) return a.dueDate === null ? 1 : b.dueDate === null ? -1 : a.dueDate < b.dueDate ? -1 : 1;
    return Number(b.required) - Number(a.required);
  });

  const stages: StageSummary[] = STAGES.map((stage) => {
    const inStage = items.filter((i) => i.stage === stage && i.required && i.status !== "not_needed");
    return {
      stage,
      locked: closed || !unlocked.has(stage),
      done: inStage.filter((i) => i.status === "submitted").length,
      total: inStage.length,
    };
  }).filter((s) => s.total > 0 || items.some((i) => i.stage === s.stage));

  const counted = items.filter((i) => i.required && i.status !== "not_needed");
  const overall = { done: counted.filter((i) => i.status === "submitted").length, total: counted.length };

  const nextStep =
    closed
      ? null
      : items
          .filter((i) => !i.locked && !isDone(i.status))
          .sort((a, b) => {
            if (a.required !== b.required) return a.required ? -1 : 1;
            if (a.dueDate !== b.dueDate) return a.dueDate === null ? 1 : b.dueDate === null ? -1 : a.dueDate < b.dueDate ? -1 : 1;
            return STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
          })[0] ?? null;

  const activeDocs = items.filter((i) => !i.locked && i.status !== "not_needed");
  const documentTools = {
    cv: activeDocs.some((i) => i.tool === "cv"),
    coverLetter: activeDocs.some((i) => i.tool === "cover_letter"),
  };

  const appItems = items.filter((i) => i.stage === "application" && i.required && i.status !== "not_needed");
  const appDone = appItems.filter((i) => i.status === "submitted").length;
  const canMarkSubmitted = appItems.length > 0 && appDone === appItems.length;

  let trackerHint: string;
  if (closed) trackerHint = "Application closed";
  else if (input.tracker.status === "saved" || input.tracker.status === "preparing")
    trackerHint =
      appItems.length === 0
        ? "No application steps recorded yet"
        : `${appDone} of ${appItems.length} application step${appItems.length === 1 ? "" : "s"} done`;
  else trackerHint = `${overall.done} of ${overall.total} steps done`;

  return { closed, items, stages, overall, nextStep, documentTools, trackerHint, canMarkSubmitted, notices: input.notices };
}

function makeItem(
  input: PlanInput,
  unlocked: Set<Stage>,
  closed: boolean,
  status: ItemStatus,
  base: Omit<PlanItem, "locked" | "lockReason" | "status" | "daysLeft" | "overdue">,
): PlanItem {
  const locked = closed || !unlocked.has(base.stage);
  const daysLeft = base.dueDate ? daysBetween(input.today, base.dueDate) : null;
  return {
    ...base,
    status,
    locked,
    lockReason: closed ? "This application is closed" : locked ? LOCK_REASON[base.stage] : null,
    daysLeft,
    overdue: daysLeft !== null && daysLeft < 0 && !isDone(status) && !locked,
  };
}

export function stageName(stage: Stage): string {
  return STAGE_NAMES[stage];
}
