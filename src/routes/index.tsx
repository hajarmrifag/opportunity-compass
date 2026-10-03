import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { effectiveDeadline, daysUntil, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES } from "@/domain/types";
import { DEADLINE_WINDOW_DAYS } from "@/lib/validation";
import { DeadlineText, EmptyState, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — OpportunityOS" },
      { name: "description", content: "Your saved student opportunities and upcoming deadlines." },
      { property: "og:title", content: "Dashboard — OpportunityOS" },
      { property: "og:description", content: "Your saved student opportunities and upcoming deadlines." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { ready, profile, applications, getOpportunity } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  if (!ready) return <Loading />;

  // Live counts exclude fictional fixtures entirely.
  const realApps = applications.filter((a) => { const o = getOpportunity(a.opportunityId); return !!o && !o.isDemo; });
  const liveSaved = realApps.filter((a) => getOpportunity(a.opportunityId)?.verification === "web_retrieved").length;
  const demoTracked = applications.length - realApps.length;

  const counts = STATUSES.map((s) => ({ s, n: applications.filter((a) => a.status === s).length }));
  const upcoming = applications
    .map((a) => ({ a, o: getOpportunity(a.opportunityId), d: effectiveDeadline(a, getOpportunity(a.opportunityId)) }))
    .filter((x) => { const n = daysUntil(x.d); return n !== null && n >= 0 && n <= DEADLINE_WINDOW_DAYS && !["rejected", "withdrawn", "offer"].includes(x.a.status); })
    .sort((x, y) => (x.d! < y.d! ? -1 : 1))
    .slice(0, 8);

  return (
    <>
      <PageHeader title={profile?.fullName ? `Hi, ${profile.fullName.split(" ")[0]}` : "Dashboard"} sub="Your opportunities at a glance." />
      {!profile?.confirmed && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary p-5">
          <div>
            <h2 className="text-lg">Start with your Opportunity Passport</h2>
            <p className="text-sm text-muted-foreground">Eligibility stays “Unknown” until you review and confirm your Passport.</p>
          </div>
          <Link to="/passport" className="btn">{profile ? "Review & confirm" : "Create Passport"}</Link>
        </div>
      )}
      <section aria-labelledby="live-h" className="card mb-6 p-5">
        <h2 id="live-h" className="text-xl">Find real opportunities</h2>
        <p className="mb-3 text-sm text-muted-foreground">Live web search for internships, fellowships, master's programmes and jobs, with links to the original pages.</p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) navigate({ to: "/search", search: { q: q.trim() } }); }}>
          <label htmlFor="dq" className="sr-only">What are you looking for?</label>
          <input id="dq" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} placeholder="e.g. paid data science internship in Europe" />
          <button className="btn shrink-0" type="submit" disabled={q.trim().length < 2}>Search the web</button>
        </form>
      </section>
      <section aria-label="Summary" className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Saved from live search" value={liveSaved} />
        <Stat label="Tracked (real)" value={realApps.length} />
        <Stat label="Submitted or later (real)" value={realApps.filter((a) => ["submitted", "interview", "offer"].includes(a.status)).length} />
        <Stat label={`Deadlines in next ${DEADLINE_WINDOW_DAYS} days`} value={upcoming.length} />
      </section>
      <p className="mb-8 text-xs text-muted-foreground">Counts exclude fictional demo items{demoTracked ? ` (${demoTracked} demo item${demoTracked === 1 ? "" : "s"} tracked for testing)` : ""}. Deadline list covers everything you track.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-xl">Deadlines in the next {DEADLINE_WINDOW_DAYS} days</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked items close within this window. Closed, offered, rejected and withdrawn items are excluded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map(({ a, o, d }) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link to="/opportunities/$id" params={{ id: a.opportunityId }} className="font-semibold hover:underline">{o?.title ?? "Missing opportunity"}</Link>
                  <span className="text-sm"><DeadlineText iso={d} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-xl">Pipeline</h2>
          {applications.length === 0 ? (
            <EmptyState title="Nothing tracked yet" body="Save opportunities from Live search or add one you found elsewhere." action={<Link to="/search" className="btn">Live search</Link>} />
          ) : (
            <ul className="space-y-2">
              {counts.map(({ s, n }) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-24">{STATUS_LABELS[s]}</span>
                  <span className="h-2 flex-1 rounded-full bg-muted">
                    <span className="block h-2 rounded-full bg-primary" style={{ width: `${(n / applications.length) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-3xl">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
