// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildPlan } from "./buildPlan";
import { dueSoon, type Reminder } from "./reminders";
import { useMultiPlanData } from "./usePlanData";
import type { OpportunityPlanRef, TrackerState } from "./types";

type Saved = Array<{ opportunity: OpportunityPlanRef; tracker: TrackerState }>;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const SEEN_KEY = "opportunityos.reminders.seen";
const readSeen = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** All current reminders for the student's saved opportunities, most urgent first. */
export function useReminders(saved: Saved): { reminders: Reminder[]; loading: boolean } {
  const data = useMultiPlanData(saved);
  const reminders = useMemo(() => {
    const today = todayIso();
    return dueSoon(
      saved.map(({ opportunity, tracker }) => {
        const dates = data.dates[opportunity.id];
        const opp: OpportunityPlanRef = {
          ...opportunity,
          applicationDeadline: opportunity.applicationDeadline ?? dates?.applicationDeadline ?? null,
          startDate: opportunity.startDate ?? dates?.startDate ?? null,
          applicationUrl: opportunity.applicationUrl ?? dates?.applicationUrl ?? null,
        };
        const plan = buildPlan({
          opportunity: opp,
          requirements: data.requirements.filter((r) => r.opportunityId === opportunity.id),
          notices: [],
          moneySteps: [],
          progress: data.progress.filter((p) => p.opportunityId === opportunity.id),
          tracker,
          today,
        });
        return { plan, opportunity: opp };
      }),
    );
  }, [saved, data]);
  return { reminders, loading: data.loading };
}

const LEVEL_TEXT: Record<Reminder["level"], string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  three_days: "This week",
  week: "Within 7 days",
};

function ReminderRow({ r, onOpen }: { r: Reminder; onOpen?: (opportunityId: string) => void }) {
  const urgent = r.level === "overdue" || r.level === "today" || r.level === "tomorrow";
  return (
    <li className="py-2 text-sm">
      <p className={urgent ? "font-medium text-destructive" : "font-medium"}>{r.message}</p>
      <p className="text-xs text-muted-foreground">
        {r.opportunityTitle}, {LEVEL_TEXT[r.level].toLowerCase()}
      </p>
      <div className="mt-1 flex gap-3 text-xs">
        {onOpen && (
          <button className="underline underline-offset-2" onClick={() => onOpen(r.opportunityId)}>
            Open plan
          </button>
        )}
        {r.actionUrl && (
          <a className="underline underline-offset-2" href={r.actionUrl} target="_blank" rel="noreferrer">
            Continue application
          </a>
        )}
      </div>
    </li>
  );
}

/** Page section: every unfinished step with a deadline in the next 7 days, across saved opportunities. */
export function DueSoonList({ saved, onOpen }: { saved: Saved; onOpen?: (opportunityId: string) => void }) {
  const { reminders, loading } = useReminders(saved);
  if (loading) return <p className="text-sm text-muted-foreground">Checking your deadlines…</p>;
  return (
    <section aria-label="Due soon">
      <h2 className="mb-2 text-base font-semibold">Due soon</h2>
      {reminders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
      ) : (
        <ul className="divide-y">
          {reminders.map((r) => (
            <ReminderRow key={r.id} r={r} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bell for the header: shows how many reminders the student has not seen yet. */
export function ReminderBell({ saved, onOpen }: { saved: Saved; onOpen?: (opportunityId: string) => void }) {
  const { reminders } = useReminders(saved);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>(readSeen);
  const unseen = reminders.filter((r) => !seen.includes(r.id));

  const markSeen = () => {
    const next = Array.from(new Set([...seen, ...reminders.map((r) => r.id)]));
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* keep in memory */
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-label={`Reminders, ${unseen.length} new`}
        onClick={() => {
          setOpen(!open);
          if (!open) markSeen();
        }}
      >
        Reminders
        {unseen.length > 0 && (
          <span className="ml-2 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unseen.length}</span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-popover p-3 shadow-md">
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {reminders.map((r) => (
                <ReminderRow key={r.id} r={r} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
