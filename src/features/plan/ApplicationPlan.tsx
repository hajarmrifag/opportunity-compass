// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPlan, isDone, stageName, STAGES } from "./buildPlan";
import { CvStudio } from "../cv/CvStudio";
import type { BuilderAnswers } from "../cv/types";
import { DeadlineBanner } from "./DeadlineBanner";
import { CoverLetterPanel } from "./DocumentTools";
import { extractRequirementsFromPage, usePlanProgress, usePlanReference } from "./usePlanData";
import type { ItemStatus, MoneyStep, OpportunityPlanRef, PlanItem, RequirementKind, TrackerState } from "./types";

export interface ApplicationPlanProps {
  opportunity: OpportunityPlanRef;
  /** Current tracker state from the team's tracker. */
  tracker: TrackerState;
  /** Called when every application step is submitted and the student confirms. Update the tracker here. */
  onMarkSubmitted?: () => void;
  /** CV text from the student's profile, if available. */
  profileCvText?: string;
  /**
   * Optional extra steps, e.g. from the team's cost calculator ("Apply for UK ETA", "Book flights").
   * Each step: { key, label, stage, required, dueDate, note?, sourceUrl? }. Keys must be unique and stable.
   */
  moneySteps?: MoneyStep[];
  description?: string;
  /** Prefill for students building a CV from scratch (from the app's profile). */
  builderPrefill?: Partial<BuilderAnswers>;
}

/** Local date (not UTC), so "days left" is right in Hong Kong. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ADDABLE: Array<{ kind: RequirementKind; label: string }> = [
  { kind: "cv", label: "Upload CV" },
  { kind: "cover_letter", label: "Cover letter" },
  { kind: "written_answers", label: "Written answers" },
  { kind: "transcript", label: "Transcript" },
  { kind: "references", label: "References" },
  { kind: "online_test", label: "Online test" },
  { kind: "portfolio", label: "Portfolio" },
  { kind: "other", label: "Other step" },
];

export function ApplicationPlan(props: ApplicationPlanProps) {
  const { opportunity, tracker } = props;
  const ref = usePlanReference(opportunity.id);
  const opp: OpportunityPlanRef = {
    ...opportunity,
    applicationDeadline: opportunity.applicationDeadline ?? ref.dates?.applicationDeadline ?? null,
    startDate: opportunity.startDate ?? ref.dates?.startDate ?? null,
    applicationUrl: opportunity.applicationUrl ?? ref.dates?.applicationUrl ?? null,
  };
  const prog = usePlanProgress(opp);

  const moneySteps = props.moneySteps ?? [];

  const plan = useMemo(
    () =>
      buildPlan({
        opportunity: opp,
        requirements: [...ref.requirements, ...prog.userRequirements],
        notices: ref.notices,
        moneySteps,
        progress: prog.progress,
        tracker,
        today: todayIso(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ref.requirements, ref.notices, prog.userRequirements, prog.progress, moneySteps, tracker, opp.applicationDeadline],
  );

  // If we have no steps from the official page yet, read it once (the AI extracts steps with quotes).
  const [readingPage, setReadingPage] = useState(false);
  useEffect(() => {
    if (ref.loading || ref.error || !opp.officialUrl) return;
    if (ref.requirements.some((r) => r.source === "official_page")) return;
    const flag = `opportunityos.extracted.${opp.id}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      /* ignore */
    }
    setReadingPage(true);
    extractRequirementsFromPage(opp.id, opp.officialUrl)
      .then(() => ref.reload())
      .catch(() => undefined)
      .finally(() => setReadingPage(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.loading, ref.error, ref.requirements.length, opp.id, opp.officialUrl]);

  const [openTool, setOpenTool] = useState<"cv" | "cover_letter" | null>(null);
  const toolRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openTool) toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openTool]);
  const [cvText, setCvText] = useState<string | undefined>(props.profileCvText);
  const [adding, setAdding] = useState(false);

  if (ref.loading) return <Card className="p-6 text-sm text-muted-foreground">Loading application steps…</Card>;
  if (ref.error) return <Card className="p-6 text-sm">Application steps could not be loaded: {ref.error}</Card>;

  const pct = plan.overall.total ? Math.round((plan.overall.done / plan.overall.total) * 100) : 0;
  const docText = {
    title: opp.title,
    description: props.description,
    requirements: plan.items.filter((i) => i.kind !== "money").map((i) => i.label),
  };

  return (
    <Card aria-label="Application plan">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">Application plan</CardTitle>
        {plan.closed ? (
          <p className="text-sm text-muted-foreground">This application is closed.</p>
        ) : (
          <>
            <div>
              <div className="flex justify-between text-sm">
                <span>
                  {plan.overall.done} of {plan.overall.total} steps done
                </span>
                <span className="text-muted-foreground">{plan.trackerHint}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {plan.nextStep && (
              <div className="rounded-lg border border-primary bg-primary/5 p-3 text-sm">
                <p className="text-muted-foreground">Next step</p>
                <p className="font-medium">{plan.nextStep.label}</p>
                <DueText item={plan.nextStep} />
              </div>
            )}
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <DeadlineBanner plan={plan} opportunity={opp} onStatus={prog.setStatus} />

        {readingPage && <p className="text-sm text-muted-foreground">Reading the official page for application steps…</p>}

        {!plan.closed && (
          <DocumentsSection
            cv={plan.items.find((i) => i.tool === "cv") ?? null}
            coverLetter={plan.items.find((i) => i.tool === "cover_letter") ?? null}
            onOpen={(tool) => setOpenTool(tool)}
          />
        )}

        {openTool && (
          <div ref={toolRef} className="scroll-mt-4 space-y-2">
            <div className="flex justify-end">
              <button className="text-xs text-muted-foreground underline" onClick={() => setOpenTool(null)}>
                Close
              </button>
            </div>
            {openTool === "cv" && (
              <CvStudio
                opportunity={docText}
                officialUrl={opp.officialUrl}
                profilePrefill={props.builderPrefill}
                onReady={async (text) => {
                  setCvText(text);
                  const cv = plan.items.find((i) => i.tool === "cv");
                  if (!cv) await prog.addRequirement("cv", "CV", "application", "ready");
                  else if (!isDone(cv.status)) await prog.setStatus(cv.key, "ready");
                  setOpenTool(null);
                }}
              />
            )}
            {openTool === "cover_letter" && (
              <CoverLetterPanel
                initialCv={cvText}
                opportunity={docText}
                onReady={async () => {
                  const cl = plan.items.find((i) => i.tool === "cover_letter");
                  if (!cl) await prog.addRequirement("cover_letter", "Cover letter", "application", "ready");
                  else if (!isDone(cl.status)) await prog.setStatus(cl.key, "ready");
                  setOpenTool(null);
                }}
              />
            )}
          </div>
        )}

        {plan.notices.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Rules from the official page</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {plan.notices.map((n) => (
                <li key={n.id} title={n.evidenceQuote ?? undefined}>
                  {n.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {STAGES.map((stage) => {
          const items = plan.items.filter((i) => i.stage === stage);
          if (items.length === 0) return null;
          const summary = plan.stages.find((s) => s.stage === stage);
          return (
            <section key={stage}>
              <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
                <span>{stageName(stage)}</span>
                {summary && summary.total > 0 && (
                  <span className="font-normal text-muted-foreground">
                    {summary.done} of {summary.total} done
                  </span>
                )}
              </h3>
              <ul className="divide-y">
                {items.map((item) => (
                  <PlanRow
                    key={item.key}
                    item={item}
                    onStatus={(s) => prog.setStatus(item.key, s)}
                    onOpenTool={item.tool ? () => setOpenTool(item.tool) : undefined}
                    onRemove={item.source === "student_added" ? () => prog.removeRequirement(item.key) : undefined}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {!plan.closed && (
          <div className="text-sm">
            {adding ? (
              <AddRequirement
                onAdd={async (kind, label) => {
                  await prog.addRequirement(kind, label);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                Add a step from the application form
              </Button>
            )}
          </div>
        )}

        {plan.canMarkSubmitted && (tracker.status === "saved" || tracker.status === "preparing") && props.onMarkSubmitted && (
          <div className="rounded-lg border p-3 text-sm">
            <p>Every application step is submitted. Update your tracker?</p>
            <Button className="mt-2" size="sm" onClick={props.onMarkSubmitted}>
              Mark application as submitted
            </Button>
          </div>
        )}

        <p className="border-t pt-3 text-xs text-muted-foreground">
          {prog.signedIn ? "Your progress is saved to your account and visible only to you." : "Sign in to keep your progress. For now it is saved in this browser only."}
          {" "}We cannot see what you send on the employer's website, so please confirm each submission here.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Pieces ----------

const DOC_STATUS: Record<ItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  submitted: "Submitted",
  not_needed: "Not needed",
};

/** Always visible: the student can prepare a CV or cover letter for any application without adding steps first. */
function DocumentsSection({
  cv,
  coverLetter,
  onOpen,
}: {
  cv: PlanItem | null;
  coverLetter: PlanItem | null;
  onOpen: (tool: "cv" | "cover_letter") => void;
}) {
  const where = (item: PlanItem | null, fallback: string) =>
    !item ? fallback : item.source === "official_page" ? "Required by the official page" : "In your plan";
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Your documents">
      <h3 className="text-sm font-semibold">Your documents for this application</h3>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">CV</p>
          <p className="text-xs text-muted-foreground">
            {where(cv, "Most applications ask for a CV")}
            {cv ? `. ${DOC_STATUS[cv.status]}` : ""}
          </p>
        </div>
        {cv?.status !== "not_needed" && (
          <Button onClick={() => onOpen("cv")}>{cv && isDone(cv.status) ? "Open my CV" : "Tailor my CV for this opportunity"}</Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">Cover letter</p>
          <p className="text-xs text-muted-foreground">
            {where(coverLetter, "Only if the application asks for one")}
            {coverLetter ? `. ${DOC_STATUS[coverLetter.status]}` : ""}
          </p>
        </div>
        {coverLetter?.status !== "not_needed" && (
          <Button variant="outline" onClick={() => onOpen("cover_letter")}>
            Draft a cover letter
          </Button>
        )}
      </div>
    </section>
  );
}

const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "submitted", label: "Submitted" },
  { value: "not_needed", label: "Not needed" },
];

const MONEY_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: "not_started", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Done" },
  { value: "not_needed", label: "Not needed" },
];

const SOURCE_LABEL: Record<PlanItem["source"], string> = {
  official_page: "From the official page",
  team: "Added by the Source team",
  student_added: "You added this",
  money_check: "From your money check",
};

function DueText({ item }: { item: PlanItem }) {
  if (!item.dueDate && !item.dueLabel) return null;
  const date = item.dueDate
    ? new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  let left = "";
  if (item.daysLeft !== null && !isDone(item.status)) {
    left = item.daysLeft < 0 ? `, ${-item.daysLeft} days overdue` : item.daysLeft === 0 ? ", due today" : `, ${item.daysLeft} days left`;
  }
  return (
    <p className={`text-xs ${item.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
      {date ? `Due ${date}${left}` : item.dueLabel}
      {date && item.dueLabel ? ` (${item.dueLabel.toLowerCase()})` : ""}
    </p>
  );
}

function PlanRow({
  item,
  onStatus,
  onOpenTool,
  onRemove,
}: {
  item: PlanItem;
  onStatus: (s: ItemStatus) => void;
  onOpenTool?: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const options = item.kind === "money" ? MONEY_OPTIONS : STATUS_OPTIONS;
  return (
    <li className={`py-3 text-sm ${item.locked ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={item.status === "submitted" ? "text-muted-foreground line-through" : ""}>
            {item.label}
            {!item.required && <span className="text-muted-foreground"> (optional)</span>}
          </p>
          <DueText item={item} />
          {item.locked && <p className="text-xs text-muted-foreground">{item.lockReason}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">{SOURCE_LABEL[item.source]}</Badge>
            {item.reviewStatus === "ai_extracted" && <Badge variant="outline">Read from the page, not yet reviewed</Badge>}
          </div>
        </div>
        {!item.locked && (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={item.status}
            onChange={(e) => onStatus(e.target.value as ItemStatus)}
            aria-label={`Status of ${item.label}`}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-3">
        {onOpenTool && !item.locked && !isDone(item.status) && (
          <button className="text-xs font-medium underline underline-offset-2" onClick={onOpenTool}>
            {item.tool === "cv" ? "Tailor my CV for this" : "Draft a cover letter"}
          </button>
        )}
        {(item.evidenceQuote || item.note || item.sourceUrl) && (
          <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setOpen(!open)}>
            {open ? "Hide details" : "Details"}
          </button>
        )}
        {onRemove && (
          <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1 space-y-1 text-xs text-muted-foreground">
          {item.evidenceQuote && <p>On the page: "{item.evidenceQuote}"</p>}
          {item.note && <p>{item.note}</p>}
          {item.sourceUrl && (
            <a className="underline" href={item.sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function AddRequirement({ onAdd, onCancel }: { onAdd: (k: RequirementKind, label: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<RequirementKind>("cv");
  const [label, setLabel] = useState("Upload CV");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">What does the form ask for?</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as RequirementKind;
            setKind(k);
            setLabel(ADDABLE.find((a) => a.kind === k)?.label ?? "");
          }}
        >
          {ADDABLE.map((a) => (
            <option key={a.kind} value={a.kind}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">Name</span>
        <input className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <Button size="sm" onClick={() => onAdd(kind, label.trim() || "Application step")}>
        Add step
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/** One line for the tracker card, e.g. "1 of 3 application steps done". */
export function ApplicationPlanSummary({ opportunity, tracker }: { opportunity: OpportunityPlanRef; tracker: TrackerState }) {
  const ref = usePlanReference(opportunity.id);
  const prog = usePlanProgress(opportunity);
  const plan = buildPlan({
    opportunity: { ...opportunity, applicationDeadline: opportunity.applicationDeadline ?? ref.dates?.applicationDeadline ?? null },
    requirements: [...ref.requirements, ...prog.userRequirements],
    notices: [],
    moneySteps: [],
    progress: prog.progress,
    tracker,
    today: todayIso(),
  });
  const next = plan.nextStep;
  return (
    <span className="text-xs">
      {plan.trackerHint}
      {next?.daysLeft !== null && next?.daysLeft !== undefined && next.daysLeft <= 7 && !plan.closed
        ? `. ${next.label}: ${next.daysLeft <= 0 ? "due now" : `${next.daysLeft} days left`}`
        : ""}
    </span>
  );
}
