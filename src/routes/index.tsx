import { createFileRoute, Link } from "@tanstack/react-router";
import { effectiveDeadline, daysUntil, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES } from "@/domain/types";
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
  const { ready, profile, applications, opportunities, getOpportunity } = useStore();
  if (!ready) return <Loading />;

  const counts = STATUSES.map((s) => ({ s, n: applications.filter((a) => a.status === s).length }));
  const upcoming = applications
    .map((a) => ({ a, o: getOpportunity(a.opportunityId), d: effectiveDeadline(a, getOpportunity(a.opportunityId)) }))
    .filter((x) => { const n = daysUntil(x.d); return n !== null && n >= 0 && !["rejected", "withdrawn", "offer"].includes(x.a.status); })
    .sort((x, y) => (x.d! < y.d! ? -1 : 1))
    .slice(0, 5);

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
      <section aria-label="Summary" className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Opportunities available" value={opportunities.length} />
        <Stat label="Tracked" value={applications.length} />
        <Stat label="Submitted or later" value={applications.filter((a) => ["submitted", "interview", "offer"].includes(a.status)).length} />
        <Stat label="Deadlines ≤ 14 days" value={upcoming.filter((u) => (daysUntil(u.d) ?? 99) <= 14).length} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-xl">Approaching deadlines</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines among your tracked items.</p>
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
            <EmptyState title="Nothing tracked yet" body="Save opportunities from Discover or add one you found elsewhere." action={<Link to="/discover" className="btn">Discover</Link>} />
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
