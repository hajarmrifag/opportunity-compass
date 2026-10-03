import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { effectiveDeadline, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES, type Application, type ApplicationStatus } from "@/domain/types";
import { DeadlineText, EmptyState, Loading, PageHeader, SourceBadge } from "@/components/ui-bits";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "My Journey — OpportunityOS" },
      { name: "description", content: "Track application statuses, notes and deadlines." },
      { property: "og:title", content: "My Journey — OpportunityOS" },
      { property: "og:description", content: "Track application statuses, notes and deadlines." },
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
      <PageHeader title="My Journey" sub="Update statuses yourself — nothing is marked Submitted automatically." right={<Link to="/add" className="btn btn-outline">+ Add opportunity</Link>} />
      {applications.length === 0 ? (
        <EmptyState title="Your journey starts here" body="Save an opportunity from Discover, or add one you found elsewhere." action={<Link to="/discover" className="btn">Go to Discover</Link>} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {(["all", ...STATUSES] as const).map((s) => (
              <button key={s} aria-pressed={filter === s} className={`btn btn-sm ${filter === s ? "" : "btn-outline"}`} onClick={() => setFilter(s)}>
                {s === "all" ? "All" : STATUS_LABELS[s]} ({s === "all" ? applications.length : applications.filter((a) => a.status === s).length})
              </button>
            ))}
          </div>
          {list.length === 0 ? <p className="text-muted-foreground">No items with this status.</p> : (
            <ul className="space-y-4">{list.map((a) => <AppRow key={a.id} app={a} />)}</ul>
          )}
        </>
      )}
    </>
  );
}

function AppRow({ app }: { app: Application }) {
  const { getOpportunity, updateApplication, removeApplication } = useStore();
  const opp = getOpportunity(app.opportunityId);
  const [notes, setNotes] = useState(app.notes);
  const [savedMsg, setSavedMsg] = useState("");
  const dirty = notes !== app.notes;

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {opp ? (
            <>
              <div className="mb-1"><SourceBadge opp={opp} /></div>
              <Link to="/opportunities/$id" params={{ id: opp.id }} className="text-lg font-semibold hover:underline">{opp.title}</Link>
              <p className="text-sm text-muted-foreground">{opp.organization}</p>
            </>
          ) : <p className="font-semibold text-destructive">Opportunity data missing</p>}
          <p className="mt-1 text-sm"><DeadlineText iso={effectiveDeadline(app, opp)} /></p>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor={`st-${app.id}`}>Status</label>
          <select id={`st-${app.id}`} value={app.status} onChange={(e) => updateApplication(app.id, { status: e.target.value as ApplicationStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px]">
        <div>
          <label htmlFor={`n-${app.id}`}>Notes</label>
          <textarea id={`n-${app.id}`} rows={2} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSavedMsg(""); }} />
          <div className="mt-1 flex items-center gap-2">
            <button className="btn btn-sm" disabled={!dirty} onClick={() => { updateApplication(app.id, { notes }); setSavedMsg("Notes saved"); }}>Save notes</button>
            <span className="text-xs text-success" aria-live="polite">{savedMsg}</span>
          </div>
        </div>
        <div>
          <label htmlFor={`d-${app.id}`}>My deadline (optional)</label>
          <input id={`d-${app.id}`} type="date" value={app.deadline ?? ""} onChange={(e) => updateApplication(app.id, { deadline: e.target.value || null })} />
        </div>
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>Updated {new Date(app.updatedAt).toLocaleString()}</span>
        <button className="underline hover:text-destructive" onClick={() => { if (confirm("Stop tracking this opportunity?")) removeApplication(app.id); }}>Remove</button>
      </div>
    </li>
  );
}
