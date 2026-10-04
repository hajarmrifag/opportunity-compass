import type { ReactNode } from "react";
import type { CoverageStatus, Opportunity, RequirementStatus } from "@/domain/types";
import { CATEGORY_LABELS } from "@/domain/types";
import { deadlineState } from "@/lib/validation";

export function DemoBadge() {
  return (
    <span className="chip chip-demo" title="Fictional demo data, not verified">
      Demo data
    </span>
  );
}

export function SourceBadge({ opp }: { opp: Opportunity }) {
  if (opp.isDemo) return <DemoBadge />;
  if (opp.verification === "user_entered")
    return <span className="chip chip-muted">Added by you</span>;
  if (opp.verification === "web_retrieved")
    return (
      <span
        className="chip chip-unknown"
        title="Extracted from the source page; not human-verified"
      >
        From live web · unverified
      </span>
    );
  return <span className="chip chip-met">Verified</span>;
}

export function CategoryChip({ opp }: { opp: Opportunity }) {
  return <span className="chip chip-teal">{CATEGORY_LABELS[opp.category]}</span>;
}

export function DeadlineText({ iso }: { iso: string | null }) {
  const { state, days } = deadlineState(iso);
  if (state === "unknown") return <span className="text-muted-foreground">Deadline unknown</span>;
  if (state === "invalid")
    return <span className="text-destructive">Invalid deadline. Check the date</span>;
  const label =
    state === "expired"
      ? "Closed"
      : days === 0
        ? "Closes today"
        : `${days} day${days === 1 ? "" : "s"} left`;
  const cls =
    state === "expired"
      ? "text-muted-foreground line-through"
      : state === "closing_soon"
        ? "font-semibold text-warning-strong"
        : "text-muted-foreground";
  return (
    <span className={cls}>
      {new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}{" "}
      · {label}
    </span>
  );
}

const REQ: Record<RequirementStatus, { label: string; cls: string; icon: string }> = {
  met: { label: "Met", cls: "chip-met", icon: "✓" },
  not_met: { label: "Not met", cls: "chip-notmet", icon: "✕" },
  unknown: { label: "Unknown", cls: "chip-unknown", icon: "?" },
};
export function ReqStatus({ s }: { s: RequirementStatus }) {
  const r = REQ[s];
  return (
    <span className={`chip ${r.cls}`}>
      <span aria-hidden>{r.icon}</span> {r.label}
    </span>
  );
}

const COV: Record<CoverageStatus, { label: string; cls: string }> = {
  covered: { label: "Covered", cls: "chip-met" },
  partial: { label: "Partial", cls: "chip-unknown" },
  not_covered: { label: "Not covered", cls: "chip-notmet" },
  unknown: { label: "Unknown", cls: "chip-muted" },
};
export function CoverageChip({ s }: { s: CoverageStatus }) {
  return <span className={`chip ${COV[s].cls}`}>{COV[s].label}</span>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="atlas-empty flex flex-col items-start gap-3 py-10 text-left">
      <div aria-hidden className="atlas-empty-mark">
        ∅
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="max-w-md text-base text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  right,
  kicker = "Sourced",
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  kicker?: string;
}) {
  return (
    <header className="atlas-page-header mb-10 flex flex-col items-start gap-5 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <p className="atlas-kicker">{kicker}</p>
        <h1 className="font-display">{title}</h1>
        {sub && <p className="atlas-page-deck">{sub}</p>}
      </div>
      {right ? <div className="atlas-page-actions flex flex-wrap gap-2">{right}</div> : null}
    </header>
  );
}
