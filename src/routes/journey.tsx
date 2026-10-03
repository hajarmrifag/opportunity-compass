import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { effectiveDeadline, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES, type Application, type ApplicationStatus } from "@/domain/types";
import { DeadlineText, EmptyState, Loading, PageHeader, SourceBadge } from "@/components/ui-bits";
import { ActionPlan } from "@/components/ActionPlan";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "My Journey — Source" },
      { name: "description", content: "Track application statuses, notes and deadlines." },
      { property: "og:title", content: "My Journey — Source" },
      { property: "og:description", content: "Track application statuses, notes and deadlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Journey,
});

function Journey() {
  const { ready, applications } = useStore();
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  if (!ready) return <Loading />;
  const list = applications.filter((a) => filter === "all" || a.status === filter);

  return (
    <>
      <PageHeader
        title="My Journey"
        sub="Update statuses yourself — nothing is marked Submitted automatically."
        right={
          <div className="flex flex-wrap gap-2">
            <Link to="/tracker-io" className="btn btn-ghost">
              Import / export
            </Link>
            <Link to="/add" className="btn btn-outline">
              + Add opportunity
            </Link>
          </div>
        }
      />
      {applications.length === 0 ? (
        <EmptyState
          title="Your journey starts here"
          body="Find real opportunities with Live search, or add one you found elsewhere."
          action={
            <Link to="/search" className="btn">
              Go to Live search
            </Link>
          }
        />
      ) : (
        <>
          <div className="atlas-journey-path mb-8" role="group" aria-label="Filter by status">
            {(["all", ...STATUSES] as const).map((s) => (
              <button
                key={s}
                aria-pressed={filter === s}
                className={`atlas-journey-step ${filter === s ? "atlas-journey-step-active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]} (
                {s === "all"
                  ? applications.length
                  : applications.filter((a) => a.status === s).length}
                )
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="text-muted-foreground">No items with this status.</p>
          ) : (
            <ol className="space-y-6">
              {list.map((a, index) => (
                <AppRow key={a.id} app={a} index={index + 1} />
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}

function AppRow({ app, index }: { app: Application; index: number }) {
  const { getOpportunity, updateApplication, removeApplication } = useStore();
  const opp = getOpportunity(app.opportunityId);
  const [notes, setNotes] = useState(app.notes);
  const [savedMsg, setSavedMsg] = useState("");
  const dirty = notes !== app.notes;

  return (
    <li className="atlas-journey-card border border-border bg-card p-5 md:p-7">
      <div className="atlas-result-number mb-4">{String(index).padStart(2, "0")}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {opp ? (
            <>
              <div className="mb-1">
                <SourceBadge opp={opp} />
              </div>
              <Link
                to="/opportunities/$id"
                params={{ id: opp.id }}
                className="text-lg font-semibold hover:underline"
              >
                {opp.title}
              </Link>
              <div className="mt-2">
                <Link
                  to="/opportunities/$id"
                  params={{ id: opp.id }}
                  className="btn btn-outline btn-sm"
                >
                  View opportunity brief
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">{opp.organization}</p>
            </>
          ) : (
            <p className="font-semibold text-destructive">Opportunity data missing</p>
          )}
          <p className="mt-1 text-sm">
            <DeadlineText iso={effectiveDeadline(app, opp)} />
          </p>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor={`st-${app.id}`}>Status</label>
          <select
            id={`st-${app.id}`}
            value={app.status}
            onChange={(e) =>
              updateApplication(app.id, { status: e.target.value as ApplicationStatus })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px]">
        <div>
          <label htmlFor={`n-${app.id}`}>Notes</label>
          <textarea
            id={`n-${app.id}`}
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSavedMsg("");
            }}
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              className="btn btn-sm"
              disabled={!dirty}
              onClick={() => {
                updateApplication(app.id, { notes });
                setSavedMsg("Notes saved");
              }}
            >
              Save notes
            </button>
            <span className="text-xs text-success" aria-live="polite">
              {savedMsg}
            </span>
          </div>
        </div>
        <div>
          <label htmlFor={`d-${app.id}`}>My deadline (optional)</label>
          <input
            id={`d-${app.id}`}
            type="date"
            value={app.deadline ?? ""}
            onChange={(e) => updateApplication(app.id, { deadline: e.target.value || null })}
          />
        </div>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <ActionPlan application={app} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>Updated {new Date(app.updatedAt).toLocaleString()}</span>
        <button
          className="underline hover:text-destructive"
          onClick={() => {
            if (confirm("Stop tracking this opportunity?")) removeApplication(app.id);
          }}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
