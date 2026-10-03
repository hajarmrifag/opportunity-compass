// Pure dashboard math for the Tracker. Everything is counted from the user's own
// database rows (applications, application_events, coffee_chats) — never AI.
import type { CoffeeChat, TrackerApplication, TrackerEvent } from "@/lib/tracker.functions";

const PIPELINE = ["saved", "preparing", "submitted", "assessment", "interview", "offer"] as const;
type PipelineStage = (typeof PIPELINE)[number];

export const FUNNEL_STAGES: PipelineStage[] = [
  "saved",
  "submitted",
  "assessment",
  "interview",
  "offer",
];

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eventsByApp(events: TrackerEvent[]): Map<string, TrackerEvent[]> {
  const map = new Map<string, TrackerEvent[]>();
  for (const e of events) {
    const list = map.get(e.application_id) ?? [];
    list.push(e);
    map.set(e.application_id, list);
  }
  return map;
}

/** True when the application ever reached `stage` (from history or its current status). */
export function reachedStage(
  app: TrackerApplication,
  stage: PipelineStage,
  history: TrackerEvent[],
): boolean {
  if (stage === "saved") return true;
  if (app.status === stage || history.some((e) => e.status === stage)) return true;
  // An offer implies an interview; any later stage implies the application was submitted.
  // Assessments are never assumed — many processes skip them.
  if (stage === "interview")
    return app.status === "offer" || history.some((e) => e.status === "offer");
  if (stage === "submitted") {
    const after = ["assessment", "interview", "offer"];
    return after.includes(app.status) || history.some((e) => after.includes(e.status));
  }
  return false;
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export function funnelCounts(apps: TrackerApplication[], events: TrackerEvent[]): CountRow[] {
  const byApp = eventsByApp(events);
  const labels: Record<string, string> = {
    saved: "Saved",
    submitted: "Submitted",
    assessment: "Assessment",
    interview: "Interview",
    offer: "Offer",
  };
  const rows: CountRow[] = FUNNEL_STAGES.map((stage) => ({
    key: stage as string,
    label: labels[stage] ?? stage,
    count: apps.filter((a) => reachedStage(a, stage, byApp.get(a.id) ?? [])).length,
  }));
  rows.push({
    key: "rejected",
    label: "Rejected",
    count: apps.filter((a) => a.status === "rejected").length,
  });
  return rows;
}

/** Date the application was submitted: applied date, else first "submitted" event. */
export function submittedOn(app: TrackerApplication, history: TrackerEvent[]): string | null {
  if (app.applied_date) return app.applied_date;
  const ev = history.find((e) => e.status === "submitted");
  return ev ? isoDate(new Date(ev.date)) : null;
}

function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  return out;
}

function parseLocal(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function submittedPerWeek(
  apps: TrackerApplication[],
  events: TrackerEvent[],
  today: Date,
  weeks = 8,
): CountRow[] {
  const byApp = eventsByApp(events);
  const start = mondayOf(today);
  const rows: CountRow[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(start);
    w.setDate(w.getDate() - i * 7);
    rows.push({
      key: isoDate(w),
      label: w.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      count: 0,
    });
  }
  for (const a of apps) {
    const on = submittedOn(a, byApp.get(a.id) ?? []);
    if (!on) continue;
    const key = isoDate(mondayOf(parseLocal(on)));
    const row = rows.find((r) => r.key === key);
    if (row) row.count += 1;
  }
  return rows;
}

export function chatsPerMonth(chats: CoffeeChat[], today: Date, months = 6): CountRow[] {
  const rows: CountRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
    rows.push({
      key: isoDate(m).slice(0, 7),
      label: m.toLocaleDateString(undefined, { month: "short" }),
      count: 0,
    });
  }
  for (const c of chats) {
    if (!c.date) continue;
    const row = rows.find((r) => r.key === c.date!.slice(0, 7));
    if (row) row.count += 1;
  }
  return rows;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  cold: "Cold",
  career_fair: "Career fair",
  other: "Other",
};

export function interviewsBySource(apps: TrackerApplication[], events: TrackerEvent[]): CountRow[] {
  const byApp = eventsByApp(events);
  return Object.entries(SOURCE_LABELS).map(([key, label]) => ({
    key,
    label,
    count: apps.filter(
      (a) => a.source === key && reachedStage(a, "interview", byApp.get(a.id) ?? []),
    ).length,
  }));
}

/** Applications whose next action is due today or overdue (skips closed ones). */
export function applicationsDue(apps: TrackerApplication[], today: string): TrackerApplication[] {
  return apps
    .filter(
      (a) =>
        a.next_action_date &&
        a.next_action_date <= today &&
        a.status !== "rejected" &&
        a.status !== "withdrawn",
    )
    .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1));
}

/** Coffee chats that happened but have no notes, or whose follow-up is due/overdue. */
export function chatsNeedingAttention(
  chats: CoffeeChat[],
  today: string,
): { chat: CoffeeChat; reason: string }[] {
  const out: { chat: CoffeeChat; reason: string }[] = [];
  for (const c of chats) {
    if (c.follow_up_date && !c.follow_up_done && c.follow_up_date <= today) {
      out.push({
        chat: c,
        reason:
          c.follow_up_date === today
            ? "Follow-up due today"
            : `Follow-up overdue since ${c.follow_up_date}`,
      });
    } else if (c.date && c.date <= today && !c.notes.trim()) {
      out.push({ chat: c, reason: "Add notes from this chat" });
    }
  }
  return out;
}
