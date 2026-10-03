import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  HandHeart,
  IdCard,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { effectiveDeadline, daysUntil, useStore } from "@/lib/store";
import { STATUS_LABELS, STATUSES, type Category } from "@/domain/types";
import { DEADLINE_WINDOW_DAYS } from "@/lib/validation";
import { DeadlineText, EmptyState, Loading } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Opportunity Atlas — OpportunityOS" },
      {
        name: "description",
        content: "Search, compare and map your next student opportunity with OpportunityOS.",
      },
      { property: "og:title", content: "Opportunity Atlas — OpportunityOS" },
      {
        property: "og:description",
        content: "Search, compare and map your next student opportunity with OpportunityOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const GOALS = [
  {
    value: "internship",
    label: "Internship",
    description: "Build experience with a team and a defined role.",
    icon: BriefcaseBusiness,
  },
  {
    value: "job",
    label: "Job",
    description: "Explore roles across sectors and career stages.",
    icon: UsersRound,
  },
  {
    value: "masters",
    label: "Master’s",
    description: "Explore taught and research postgraduate programmes.",
    icon: GraduationCap,
  },
  {
    value: "fellowship",
    label: "Fellowship",
    description: "Find structured professional or academic programmes.",
    icon: Sparkles,
  },
  {
    value: "scholarship",
    label: "Scholarship",
    description: "Search for support toward study costs.",
    icon: HandHeart,
  },
] as const satisfies ReadonlyArray<{
  value: Category;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}>;

function Dashboard() {
  const { ready, profile, applications, getOpportunity } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState<Category | null>(null);
  if (!ready) return <Loading />;

  const realApps = applications.filter((application) => {
    const opportunity = getOpportunity(application.opportunityId);
    return Boolean(opportunity && !opportunity.isDemo);
  });
  const liveSaved = realApps.filter(
    (application) => getOpportunity(application.opportunityId)?.verification === "web_retrieved",
  ).length;
  const demoTracked = applications.length - realApps.length;
  const counts = STATUSES.map((status) => ({
    status,
    count: applications.filter((application) => application.status === status).length,
  }));
  const upcoming = applications
    .map((application) => ({
      application,
      opportunity: getOpportunity(application.opportunityId),
      deadline: effectiveDeadline(application, getOpportunity(application.opportunityId)),
    }))
    .filter((item) => {
      const days = daysUntil(item.deadline);
      return (
        days !== null &&
        days >= 0 &&
        days <= DEADLINE_WINDOW_DAYS &&
        !["rejected", "withdrawn", "offer"].includes(item.application.status)
      );
    })
    .sort((a, b) => (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31"))
    .slice(0, 8);
  const nextTask = applications
    .flatMap((application) =>
      application.tasks
        .filter((task) => !task.completed)
        .map((task) => ({
          task,
          application,
          opportunity: getOpportunity(application.opportunityId),
        })),
    )
    .sort((a, b) =>
      (a.task.dueDate ?? "9999-12-31").localeCompare(b.task.dueDate ?? "9999-12-31"),
    )[0];
  const submitSearch = () => {
    const query = [q.trim(), goal ? GOALS.find((item) => item.value === goal)?.label : ""]
      .filter(Boolean)
      .join(" ");
    if (query.length >= 2) navigate({ to: "/search", search: { q: query } });
  };

  return (
    <div className="atlas-dashboard">
      <header className="atlas-cover-grid">
        <section className="atlas-cover-copy" aria-labelledby="dashboard-title">
          <p className="atlas-kicker">OpportunityOS</p>
          <h1 id="dashboard-title" className="atlas-cover-title">
            Your next
            <br />
            <em>starts here.</em>
          </h1>
          <p className="atlas-cover-deck">
            Search broadly, compare carefully, and turn the right opportunity into a clear next
            step.
          </p>
          <form
            className="atlas-cover-search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <label htmlFor="dq" className="sr-only">
              What are you looking for?
            </label>
            <Search aria-hidden className="size-5 shrink-0" />
            <input
              id="dq"
              value={q}
              maxLength={200}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Describe the opportunity you want…"
            />
            <Button
              className="atlas-search-submit"
              type="submit"
              disabled={[q.trim(), goal].filter(Boolean).length === 0}
              aria-label="Search the public web"
              size="icon"
            >
              <ArrowRight aria-hidden />
            </Button>
          </form>
          <div className="atlas-cover-next" aria-label="Next action">
            <span className="atlas-section-number">Next</span>
            <div className="min-w-0">
              <strong>{nextTask ? nextTask.task.label : "Start with a promising lead"}</strong>
              <p>
                {nextTask
                  ? `${nextTask.opportunity?.title ?? "Saved opportunity"}${
                      nextTask.task.dueDate
                        ? ` · due ${new Date(`${nextTask.task.dueDate}T00:00:00`).toLocaleDateString()}`
                        : " · no due date set"
                    }`
                  : "Search or browse a direction, then save what deserves attention."}
              </p>
            </div>
            <Link to={nextTask ? "/journey" : "/search"} className="atlas-text-link">
              {nextTask ? "Open plan" : "Browse all"} <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>

        <section className="atlas-direction-panel" aria-labelledby="direction-title">
          <div className="atlas-direction-heading">
            <p className="atlas-kicker">Browse by goal</p>
            <h2 id="direction-title">Choose your direction</h2>
            <p>Select one focus to add it to your search.</p>
          </div>
          <div className="atlas-direction-list" role="group" aria-label="Choose a goal">
            {GOALS.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant="ghost"
                aria-pressed={goal === item.value}
                onClick={() => setGoal(goal === item.value ? null : item.value)}
                className={`atlas-direction-row ${goal === item.value ? "atlas-direction-active" : ""}`}
              >
                <span className="atlas-direction-glyph" aria-hidden>
                  <item.icon />
                </span>
                <span className="atlas-direction-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <ArrowRight className="atlas-direction-arrow" aria-hidden />
              </Button>
            ))}
          </div>
        </section>
      </header>

      {!profile?.confirmed && (
        <section className="atlas-passport-callout" aria-labelledby="passport-callout">
          <span className="atlas-passport-icon" aria-hidden>
            <IdCard />
          </span>
          <div>
            <h2 id="passport-callout">Complete your Passport</h2>
            <p>Eligibility remains Unknown until you confirm the information in your Passport.</p>
          </div>
          <Link to="/passport" className="atlas-text-link">
            {profile ? "Review Passport" : "Create Passport"} <ArrowRight aria-hidden />
          </Link>
        </section>
      )}

      <section className="atlas-section" aria-labelledby="journey-map-title">
        <div className="atlas-section-heading">
          <span className="atlas-section-number">01</span>
          <div>
            <p className="atlas-kicker">Current coordinates</p>
            <h2 id="journey-map-title">Your journey map</h2>
          </div>
          <Link to="/journey" className="atlas-text-link">
            Open journey <ArrowRight aria-hidden />
          </Link>
        </div>
        {applications.length === 0 ? (
          <EmptyState
            title="No route plotted yet"
            body="Save a sourced opportunity to start your journey."
            action={
              <Link to="/search" className="btn">
                Search opportunities
              </Link>
            }
          />
        ) : (
          <ol className="atlas-stage-strip">
            {counts.map(({ status, count }, index) => (
              <li key={status} className={count > 0 ? "atlas-stage-active" : ""}>
                <span className="atlas-stage-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{count}</strong>
                <span>{STATUS_LABELS[status]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="atlas-deadline-band" aria-labelledby="deadline-watch-title">
        <div>
          <span className="atlas-section-number">02</span>
          <p className="atlas-kicker">Deadline watch</p>
        </div>
        <div>
          {upcoming[0] ? (
            <>
              <h2 id="deadline-watch-title">
                {upcoming[0].opportunity?.title ?? "Tracked opportunity"}
              </h2>
              <DeadlineText iso={upcoming[0].deadline} />
            </>
          ) : (
            <>
              <h2 id="deadline-watch-title">No urgent deadlines</h2>
              <p>Your next {DEADLINE_WINDOW_DAYS} days are clear based on saved dates.</p>
            </>
          )}
        </div>
        <p className="atlas-unknown-note">Unknown deadlines stay visible in My Journey.</p>
      </section>

      <section className="atlas-section" aria-labelledby="field-notes-title">
        <div className="atlas-section-heading">
          <span className="atlas-section-number">03</span>
          <div>
            <p className="atlas-kicker">Field notes</p>
            <h2 id="field-notes-title">What you are tracking</h2>
          </div>
        </div>
        <div className="atlas-stat-grid">
          <Stat index="A" label="Saved from live search" value={liveSaved} />
          <Stat index="B" label="Tracked · real" value={realApps.length} />
          <Stat
            index="C"
            label="Submitted or later · real"
            value={
              realApps.filter((application) =>
                ["submitted", "interview", "offer"].includes(application.status),
              ).length
            }
          />
          <Stat
            index="D"
            label={`Deadlines · next ${DEADLINE_WINDOW_DAYS} days`}
            value={upcoming.length}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Counts exclude fictional demo items
          {demoTracked
            ? ` (${demoTracked} demo item${demoTracked === 1 ? "" : "s"} tracked for testing)`
            : ""}
          . Deadline count includes everything you track.
        </p>
      </section>
    </div>
  );
}

function Stat({ index, label, value }: { index: string; label: string; value: number }) {
  return (
    <div className="atlas-stat">
      <span>{index}</span>
      <strong>{value}</strong>
      <p>{label}</p>
    </div>
  );
}
