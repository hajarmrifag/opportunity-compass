import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applicationStatus } from "./reminders";
import type { ItemStatus, OpportunityPlanRef, PlanResult } from "./types";

const TONE: Record<"calm" | "soon" | "urgent", string> = {
  calm: "border-border",
  soon: "border-primary bg-primary/5",
  urgent: "border-destructive bg-destructive/5",
};

/**
 * Shows what is done, what is missing and when the application closes,
 * with a button back to the employer's application page.
 * When the student comes back to the tab, it asks what they submitted.
 */
export function DeadlineBanner({
  plan,
  opportunity,
  onStatus,
}: {
  plan: PlanResult;
  opportunity: OpportunityPlanRef;
  onStatus: (itemKey: string, status: ItemStatus) => void;
}) {
  const summary = applicationStatus(plan);
  const url = opportunity.applicationUrl ?? opportunity.officialUrl ?? null;
  const flag = `opportunityos.returning.${opportunity.id}`;
  const [askOnReturn, setAskOnReturn] = useState(false);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && sessionStorage.getItem(flag)) {
        sessionStorage.removeItem(flag);
        setAskOnReturn(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [flag]);

  if (!summary && !askOnReturn) return null;
  const open = summary?.missing ?? [];

  return (
    <div className="space-y-3">
      {summary && (
        <div className={`rounded-lg border p-3 text-sm ${TONE[summary.tone]}`} role={summary.tone === "urgent" ? "alert" : "status"}>
          <p className="font-medium">{summary.headline}</p>
          {summary.detail && <p className="mt-1 text-muted-foreground">{summary.detail}</p>}
          {url && (
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                sessionStorage.setItem(flag, "1");
                window.open(url, "_blank", "noopener");
              }}
            >
              Continue application
            </Button>
          )}
        </div>
      )}

      {askOnReturn && open.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">Welcome back. Did you submit anything?</p>
          <ul className="mt-2 space-y-2">
            {open.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{item.label}</span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => onStatus(item.key, "submitted")}>
                    Submitted
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onStatus(item.key, "in_progress")}>
                    Started, not sent
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <button className="mt-2 text-xs text-muted-foreground underline" onClick={() => setAskOnReturn(false)}>
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
