import { isDone } from "./buildPlan";
import type { OpportunityPlanRef, PlanItem, PlanResult } from "./types";

export type ReminderLevel = "week" | "three_days" | "tomorrow" | "today" | "overdue";

export interface Reminder {
  id: string; // stable: opportunity + item + level, so "seen" survives reloads
  opportunityId: string;
  opportunityTitle: string;
  itemKey: string;
  itemLabel: string;
  level: ReminderLevel;
  dueDate: string;
  daysLeft: number;
  message: string;
  actionUrl: string | null;
}

/** 7 days or less → week; 3 or less → three_days; 1 → tomorrow; 0 → today; below 0 → overdue. More than 7 days → no reminder. */
export function reminderLevel(daysLeft: number | null): ReminderLevel | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  if (daysLeft <= 3) return "three_days";
  if (daysLeft <= 7) return "week";
  return null;
}

const URGENCY: Record<ReminderLevel, number> = { overdue: 0, today: 1, tomorrow: 2, three_days: 3, week: 4 };

function whenText(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "due today";
  if (daysLeft === 1) return "due tomorrow";
  return `due in ${daysLeft} days`;
}

function needsReminder(i: PlanItem): boolean {
  return !i.locked && !isDone(i.status) && i.dueDate !== null && i.daysLeft !== null;
}

/** Reminders for one opportunity: unfinished, unlocked steps with a deadline within 7 days (or overdue). */
export function remindersFor(plan: PlanResult, opportunity: OpportunityPlanRef): Reminder[] {
  if (plan.closed) return [];
  const url = opportunity.applicationUrl ?? opportunity.officialUrl ?? null;
  const out: Reminder[] = [];
  for (const item of plan.items) {
    if (!needsReminder(item)) continue;
    const level = reminderLevel(item.daysLeft);
    if (!level) continue;
    if (!item.required && level === "week") continue; // optional steps only remind close to the date
    out.push({
      id: `${opportunity.id}:${item.key}:${level}`,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      itemKey: item.key,
      itemLabel: item.label,
      level,
      dueDate: item.dueDate!,
      daysLeft: item.daysLeft!,
      message: `${item.label}: ${whenText(item.daysLeft!)}`,
      actionUrl: url,
    });
  }
  return out;
}

/** Due-soon list across all saved opportunities, most urgent first. */
export function dueSoon(all: Array<{ plan: PlanResult; opportunity: OpportunityPlanRef }>): Reminder[] {
  return all
    .flatMap(({ plan, opportunity }) => remindersFor(plan, opportunity))
    .sort((a, b) => URGENCY[a.level] - URGENCY[b.level] || a.daysLeft - b.daysLeft || a.opportunityTitle.localeCompare(b.opportunityTitle));
}

export interface ApplicationStatusSummary {
  tone: "calm" | "soon" | "urgent";
  headline: string; // e.g. "Cover letter still missing"
  detail: string | null; // e.g. "CV submitted. Application closes in 5 days (4 Dec 2026)."
  missing: PlanItem[];
  submitted: PlanItem[];
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Summary for the banner at the top of an application: what is done, what is still missing,
 * and how long is left. Returns null when nothing needs attention.
 */
export function applicationStatus(plan: PlanResult): ApplicationStatusSummary | null {
  if (plan.closed) return null;
  const app = plan.items.filter((i) => i.stage === "application" && i.required && i.status !== "not_needed" && !i.locked);
  const missing = app.filter((i) => i.status !== "submitted");
  const submitted = app.filter((i) => i.status === "submitted");

  // Assessment or later steps that are open and unfinished are more urgent than the application itself.
  const openLater = plan.items.filter((i) => i.stage !== "application" && needsReminder(i) && i.required);
  const focus = [...openLater, ...missing].filter((i) => i.daysLeft !== null).sort((a, b) => a.daysLeft! - b.daysLeft!)[0];

  if (missing.length === 0 && openLater.length === 0) return null;

  const names = (items: PlanItem[]) => items.map((i) => i.label.toLowerCase()).join(", ");
  const target = openLater.length > 0 ? openLater : missing;
  const headline =
    target.length === 1 ? `${target[0].label} still to do` : `${target.length} steps still to do`;

  let detail: string | null = null;
  const parts: string[] = [];
  if (submitted.length > 0 && missing.length > 0) parts.push(`Done: ${names(submitted)}. Still missing: ${names(missing)}.`);
  if (focus && focus.dueDate) {
    const d = focus.daysLeft!;
    const when = d < 0 ? `was due ${fmt(focus.dueDate)}` : d === 0 ? "is due today" : `closes in ${d} day${d === 1 ? "" : "s"} (${fmt(focus.dueDate)})`;
    parts.push(`${focus.stage === "application" ? "The application" : focus.label} ${when}.`);
  }
  detail = parts.length ? parts.join(" ") : null;

  const days = focus?.daysLeft ?? null;
  const tone: ApplicationStatusSummary["tone"] = days !== null && days <= 3 ? "urgent" : days !== null && days <= 7 ? "soon" : "calm";
  return { tone, headline, detail, missing, submitted };
}
