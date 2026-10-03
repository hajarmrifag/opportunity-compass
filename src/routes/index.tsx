import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { effectiveDeadline, daysUntil, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES, type Category } from "@/domain/types";
import { DEADLINE_WINDOW_DAYS } from "@/lib/validation";
import { DeadlineText, EmptyState, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — OpportunityOS" },
      { name: "description", content: "Your saved student opportunities and upcoming deadlines." },
      { property: "og:title", content: "Dashboard — OpportunityOS" },
      {
        property: "og:description",
        content: "Your saved student opportunities and upcoming deadlines.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { ready, profile, applications, getOpportunity } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState<Category | null>(null);
  if (!ready) return <Loading />;

  // Live counts exclude fictional fixtures entirely.
  const realApps = applications.filter((a) => {
    const o = getOpportunity(a.opportunityId);
    return !!o && !o.isDemo;
  });
  const liveSaved = realApps.filter(
    (a) => getOpportunity(a.opportunityId)?.verification === "web_retrieved",
  ).length;
  const demoTracked = applications.length - realApps.length;

  const counts = STATUSES.map((s) => ({ s, n: applications.filter((a) => a.status === s).length }));
  const upcoming = applications
    .map((a) => ({
      a,
      o: getOpportunity(a.opportunityId),
      d: effectiveDeadline(a, getOpportunity(a.opportunityId)),
    }))
    .filter((x) => {
      const n = daysUntil(x.d);
      return (
        n !== null &&
        n >= 0 &&
        n <= DEADLINE_WINDOW_DAYS &&
        !["rejected", "withdrawn", "offer"].includes(x.a.status)
      );
    })
    .sort((x, y) => (x.d! < y.d! ? -1 : 1))
    .slice(0, 8);
  const nextTask = applications
    .flatMap((a) =>
      a.tasks
        .filter((task) => !task.completed)
        .map((task) => ({ task, app: a, opp: getOpportunity(a.opportunityId) })),
    )
    .sort((a, b) =>
      (a.task.dueDate ?? "9999-12-31").localeCompare(b.task.dueDate ?? "9999-12-31"),
    )[0];
  const submitSearch = () => {
    const query = [q.trim(), goal ? STATUS_GOALS[goal] : ""].filter(Boolean).join(" ");
    if (query.length >= 2) navigate({ to: "/search", search: { q: query } });
  };

  return (
    <>
      <PageHeader
        title={
          profile?.fullName
            ? `Welcome back, ${profile.fullName.split(" ")[0]}`
            : "Your opportunity workspace"
        }
        sub="Find the right opening, compare the facts, and keep your next step visible."
      />
      {!profile?.confirmed && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary p-5">
          <div>
            <h2 className="text-lg">Start with your Opportunity Passport</h2>
            <p className="text-sm text-muted-foreground">
              Eligibility stays “Unknown” until you review and confirm your Passport.
            </p>
          </div>
          <Link to="/passport" className="btn">
            {profile ? "Review & confirm" : "Create Passport"}
          </Link>
        </div>
      )}
      <section aria-labelledby="live-h" className="search-panel mb-8 p-6 md:p-8">
        <p className="eyebrow">Search the public web</p>
        <h2 id="live-h" className="mt-2 text-2xl md:text-3xl">
          What opportunity would move you forward?
        </h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">
          Describe it naturally. Every result links back to its original page.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <label htmlFor="dq" className="sr-only">
            What are you looking for?
          </label>
          <input
            className="search-input"
            id="dq"
            value={q}
            maxLength={200}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. paid data science role in Europe"
          />
          <button
            className="btn shrink-0"
            type="submit"
            disabled={[q.trim(), goal].filter(Boolean).length === 0}
          >
            Search the web
          </button>
          <div
            className="flex flex-wrap gap-2 sm:col-span-2"
            role="group"
            aria-label="Choose a goal"
          >
            {(["internship", "job", "masters", "fellowship", "scholarship"] as Category[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={goal === value}
                  onClick={() => setGoal(goal === value ? null : value)}
                  className={`goal-chip ${goal === value ? "goal-chip-active" : ""}`}
                >
                  {STATUS_GOALS[value]}
                </button>
              ),
            )}
          </div>
        </form>
      </section>
      <section className="mb-8 grid gap-4 md:grid-cols-2" aria-label="Next actions">
        <div className="action-band">
          <p className="eyebrow">Next action</p>
          {nextTask ? (
            <>
              <h2 className="mt-2 text-xl">{nextTask.task.label}</h2>
              <p className="text-sm text-muted-foreground">
                {nextTask.opp?.title ?? "Saved opportunity"}
                {nextTask.task.dueDate
                  ? ` · due ${new Date(`${nextTask.task.dueDate}T00:00:00`).toLocaleDateString()}`
                  : ""}
              </p>
              <Link
                to="/journey"
                className="mt-4 inline-flex font-semibold text-primary hover:underline"
              >
                Open action plan →
              </Link>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl">Choose your next move</h2>
              <p className="text-sm text-muted-foreground">
                Save an opportunity, then add a clear action plan in My Journey.
              </p>
              <Link
                to="/search"
                className="mt-4 inline-flex font-semibold text-primary hover:underline"
              >
                Start searching →
              </Link>
            </>
          )}
        </div>
        <div className="action-band">
          <p className="eyebrow">Deadline watch</p>
          {upcoming[0] ? (
            <>
              <h2 className="mt-2 text-xl">{upcoming[0].o?.title ?? "Tracked opportunity"}</h2>
              <p className="text-sm">
                <DeadlineText iso={upcoming[0].d} />
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl">No urgent deadlines</h2>
              <p className="text-sm text-muted-foreground">
                Your next {DEADLINE_WINDOW_DAYS} days are clear based on saved dates.
              </p>
            </>
          )}
        </div>
      </section>
      <section aria-label="Summary" className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Saved from live search" value={liveSaved} />
        <Stat label="Tracked (real)" value={realApps.length} />
        <Stat
          label="Submitted or later (real)"
          value={
            realApps.filter((a) => ["submitted", "interview", "offer"].includes(a.status)).length
          }
        />
        <Stat label={`Deadlines in next ${DEADLINE_WINDOW_DAYS} days`} value={upcoming.length} />
      </section>
      <p className="mb-8 text-xs text-muted-foreground">
        Counts exclude fictional demo items
        {demoTracked
          ? ` (${demoTracked} demo item${demoTracked === 1 ? "" : "s"} tracked for testing)`
          : ""}
        . Deadline list covers everything you track.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-xl">Deadlines in the next {DEADLINE_WINDOW_DAYS} days</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked items close within this window. Closed, offered, rejected and withdrawn
              items are excluded.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map(({ a, o, d }) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link
                    to="/opportunities/$id"
                    params={{ id: a.opportunityId }}
                    className="font-semibold hover:underline"
                  >
                    {o?.title ?? "Missing opportunity"}
                  </Link>
                  <span className="text-sm">
                    <DeadlineText iso={d} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-xl">Pipeline</h2>
          {applications.length === 0 ? (
            <EmptyState
              title="Nothing tracked yet"
              body="Save opportunities from Live search or add one you found elsewhere."
              action={
                <Link to="/search" className="btn">
                  Live search
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {counts.map(({ s, n }) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-24">{STATUS_LABELS[s]}</span>
                  <span className="h-2 flex-1 rounded-full bg-muted">
                    <span
                      className="block h-2 rounded-full bg-primary"
                      style={{ width: `${(n / applications.length) * 100}%` }}
                    />
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

const STATUS_GOALS: Partial<Record<Category, string>> &
  Record<"internship" | "job" | "masters" | "fellowship" | "scholarship", string> = {
  internship: "Internship",
  job: "Job",
  masters: "Master's",
  fellowship: "Fellowship",
  scholarship: "Scholarship",
};
