import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { emailMatchState, normalizeEmail } from "@/lib/profileExtraction";
import {
  TRACKER_SOURCES,
  TRACKER_STATUSES,
  generateAdvice,
  listCoffeeChats,
  listEmailSuggestions,
  listAllTrackerEvents,
  listTrackerApplications,
  listTrackerEvents,
  removeTrackerApplication,
  saveCoffeeChat,
<<<<<<< src/routes/_authenticated/tracker.tsx
=======
  setCoffeeChatFollowUpDone,
  defaultFollowUpDate,
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
  updateEmailSuggestion,
  updateTrackerApplication,
  updateTrackerStatus,
  type AdviceResult,
  type CoffeeChat,
  type EmailSuggestion,
  type TrackerApplication,
  type TrackerEvent,
} from "@/lib/tracker.functions";
<<<<<<< src/routes/_authenticated/tracker.tsx
import { TrackerInsights } from "@/features/tracker/Insights";
import { CoffeeChatRow, todayIso } from "@/features/tracker/CoffeeChatRow";
import { Loading, PageHeader } from "@/components/ui-bits";
=======
import {
  applicationsDue,
  chatsNeedingAttention,
  chatsPerMonth,
  funnelCounts,
  interviewsBySource,
  submittedPerWeek,
} from "@/lib/trackerStats";
import { CountChart } from "@/components/tracker/CountChart";
import { EmptyState, Loading, PageHeader } from "@/components/ui-bits";
import {
  completeGmailConnection,
  disconnectGmail,
  gmailStatus,
  scanGmailInbox,
  startGmailConnect,
} from "@/lib/gmail.functions";
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({
    meta: [
      { title: "Tracker — Source" },
      {
        name: "description",
        content:
          "Your career dashboard: applications, coffee chats, follow-ups and honest AI advice.",
      },
      { property: "og:title", content: "Tracker — Source" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Your career dashboard: applications, coffee chats, follow-ups and honest AI advice.",
      },
    ],
  }),
  component: TrackerPage,
});

const STATUS_LABEL: Record<string, string> = {
  saved: "Saved",
  preparing: "Preparing",
  submitted: "Submitted",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  cold: "Cold",
  career_fair: "Career fair",
  other: "Other",
};

function TrackerPage() {
  const queryClient = useQueryClient();
  const appsQuery = useQuery({
    queryKey: ["tracker-applications"],
    queryFn: () => listTrackerApplications(),
    refetchInterval: 15_000,
  });
  const chatsQuery = useQuery({
    queryKey: ["coffee-chats"],
    queryFn: () => listCoffeeChats(),
    refetchInterval: 15_000,
  });
  const eventsQuery = useQuery({
    queryKey: ["tracker-events-all"],
    queryFn: () => listAllTrackerEvents(),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["email-suggestions"],
    queryFn: () => listEmailSuggestions(),
    refetchInterval: 15_000,
  });
<<<<<<< src/routes/_authenticated/tracker.tsx
=======
  const [search, setSearch] = useState("");
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceError, setAdviceError] = useState("");

>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
  const apps = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);
  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tracker-applications"] });
    queryClient.invalidateQueries({ queryKey: ["tracker-events-all"] });
    queryClient.invalidateQueries({ queryKey: ["tracker-events"] });
    queryClient.invalidateQueries({ queryKey: ["coffee-chats"] });
    queryClient.invalidateQueries({ queryKey: ["email-suggestions"] });
  };

  const today = todayIso();
  const monthKey = today.slice(0, 7);
  const weekAhead = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const counts = useMemo(() => {
    const byStatus = (s: string) => apps.filter((a) => a.status === s).length;
    return {
      submitted: byStatus("submitted"),
      assessments: byStatus("assessment"),
      interviews: byStatus("interview"),
      offers: byStatus("offer"),
      rejections: byStatus("rejected"),
<<<<<<< src/routes/_authenticated/tracker.tsx
      // Any chat dated this calendar month (or logged this month without a date).
      chatsThisMonth: chats.filter((c) =>
        c.date ? c.date.slice(0, 7) === monthKey : c.created_at.slice(0, 7) === monthKey,
      ).length,
      // Overdue or due within the next 7 days.
      followUpsDue: chats.filter((c) => c.follow_up_date && c.follow_up_date <= weekAhead).length,
=======
      chatsThisMonth: chats.filter((c) => c.date && c.date >= monthStart && c.date <= today).length,
      followUpsDue:
        chats.filter((c) => c.follow_up_date && !c.follow_up_done && c.follow_up_date <= today)
          .length + applicationsDue(apps, today).length,
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
    };
  }, [apps, chats, monthKey, weekAhead]);

<<<<<<< src/routes/_authenticated/tracker.tsx
  const dueToday = useMemo(
    () =>
      chats
        .filter((c) => c.follow_up_date && c.follow_up_date <= weekAhead)
        .sort((x, y) => (x.follow_up_date ?? "").localeCompare(y.follow_up_date ?? "")),
    [chats, weekAhead],
  );

  const lastEmailUpdate = suggestions.reduce<string | null>(
    (latest, x) => (!latest || x.created_at > latest ? x.created_at : latest),
    null,
  );

  if (appsQuery.isLoading || chatsQuery.isLoading) return <Loading />;

=======
  const dueApps = useMemo(() => applicationsDue(apps, today), [apps, today]);
  const dueChats = useMemo(() => chatsNeedingAttention(chats, today), [chats, today]);

  const charts = useMemo(() => {
    const now = new Date();
    return {
      funnel: funnelCounts(apps, events),
      weekly: submittedPerWeek(apps, events, now),
      monthly: chatsPerMonth(chats, now),
      bySource: interviewsBySource(apps, events),
    };
  }, [apps, chats, events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) =>
      [a.company, a.role, a.notes, a.next_action ?? ""].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [apps, search]);

  const runAdvice = async () => {
    setAdviceBusy(true);
    setAdviceError("");
    try {
      setAdvice(await generateAdvice());
    } catch (err) {
      setAdviceError(err instanceof Error ? err.message : "Could not generate advice.");
    } finally {
      setAdviceBusy(false);
    }
  };

  if (appsQuery.isLoading || chatsQuery.isLoading) return <Loading />;

  const isEmpty = apps.length === 0 && chats.length === 0;
  const loadError = appsQuery.error ?? chatsQuery.error ?? eventsQuery.error;

>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
  return (
    <>
      <PageHeader
        title="Tracker"
        sub="Your career dashboard — counted from your own records, saved to your account. My Journey (browser-local) stays separate."
        right={
          <Link to="/resources" className="btn btn-ghost">
            Resources
          </Link>
        }
      />
      {loadError && (
        <p role="alert" className="field-error mb-4">
          Could not load your tracker: {(loadError as Error).message ?? "Unknown error"}
        </p>
      )}

      {/* 1. Summary cards — counted from the database, never AI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Applications submitted" value={counts.submitted} />
        <StatCard label="Assessments" value={counts.assessments} />
        <StatCard label="Interviews" value={counts.interviews} />
        <StatCard label="Offers" value={counts.offers} />
        <StatCard label="Rejections" value={counts.rejections} />
        <StatCard label="Coffee chats this month" value={counts.chatsThisMonth} />
        <StatCard
          label="Follow-ups due"
          value={counts.followUpsDue}
          highlight={counts.followUpsDue > 0}
        />
      </div>

<<<<<<< src/routes/_authenticated/tracker.tsx
      <>
        {/* 2. Due today */}
        <section className="card mt-6 p-5" aria-labelledby="due-today">
          <h2 id="due-today" className="text-lg font-semibold">
            Follow-ups this week
          </h2>
          {dueToday.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No follow-ups in the next 7 days. Set a follow-up date on a coffee chat and it appears
              here.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {dueToday.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-md border p-3 text-sm ${
                    c.follow_up_date && c.follow_up_date < today
                      ? "border-destructive/50"
                      : "border-border"
                  }`}
                >
                  <span className="font-medium">Follow up on {c.contact_name}</span>
                  {c.company ? ` · ${c.company}` : ""}
                  <span className="ml-2 text-xs text-muted-foreground">
                    Follow-up{" "}
                    {c.follow_up_date === today
                      ? "due today"
                      : (c.follow_up_date ?? "") < today
                        ? `overdue since ${c.follow_up_date}`
                        : `due ${c.follow_up_date}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Results from email — no manual scan button */}
        <section className="card mt-6 p-5" aria-labelledby="gmail-scan">
          <h2 id="gmail-scan" className="text-lg font-semibold">
            Results from email
          </h2>
          <p className="text-sm text-muted-foreground">
            Assessments, interviews, offers and rejections found in your email appear here.
          </p>
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {lastEmailUpdate
              ? `Last updated ${new Date(lastEmailUpdate).toLocaleString()}`
              : "Last updated: never — Gmail isn't connected yet, so no email results are available."}
          </p>
          {suggestions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <SuggestionRow key={s.id} suggestion={s} onChanged={refresh} />
              ))}
            </ul>
          )}
        </section>

        {/* 5. Applications */}
        <section className="mt-8" aria-labelledby="apps-heading">
          <h2 id="apps-heading" className="text-lg font-semibold">
            Applications
          </h2>
          {apps.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No applications tracked yet.</p>
          ) : (
            <ul className="mt-2 space-y-4">
              {apps.map((a) => (
                <TrackerRow key={a.id} app={a} onChanged={refresh} />
              ))}
            </ul>
          )}
        </section>
      </>

      {/* Coffee chats — always available, even before anything is tracked */}
      <CoffeeChatSection chats={chats} onChanged={refresh}>
        {/* Insights sit above the coffee chat history link */}
        <TrackerInsights apps={apps} chats={chats} onAdvice={() => generateAdvice()} />
      </CoffeeChatSection>
=======
      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing tracked yet"
            body="Save a listing or log a coffee chat and your dashboard fills in here."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/search" className="btn">
              Browse listings
            </Link>
          </div>
          <CoffeeChatSection chats={chats} onChanged={refresh} />
        </div>
      ) : (
        <>
          {/* 2. Due today */}
          <section className="card mt-6 p-5" aria-labelledby="due-today">
            <h2 id="due-today" className="text-lg font-semibold">
              Due today
            </h2>
            {dueApps.length === 0 && dueChats.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing due. Set a next action date on an application or a follow-up date on a
                coffee chat and it appears here.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {dueApps.map((a) => {
                  const overdue = a.next_action_date! < today;
                  return (
                    <li
                      key={a.id}
                      className={`rounded-md border p-3 text-sm ${overdue ? "border-destructive/50" : "border-border"}`}
                    >
                      <span className="font-medium">{a.next_action || "Next step"}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {a.role} at {a.company}
                      </span>
                      <span
                        className={`ml-2 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {overdue ? `Overdue since ${a.next_action_date}` : "Due today"}
                      </span>
                    </li>
                  );
                })}
                {dueChats.map(({ chat, reason }) => (
                  <li
                    key={chat.id}
                    className={`rounded-md border p-3 text-sm ${reason.startsWith("Follow-up overdue") ? "border-destructive/50" : "border-border"}`}
                  >
                    <span className="font-medium">Coffee chat: {chat.contact_name}</span>
                    {chat.company ? (
                      <span className="text-muted-foreground"> · {chat.company}</span>
                    ) : null}
                    <span className="ml-2 text-xs text-muted-foreground">{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Charts — calculated from the database, never AI */}
          <section className="mt-6" aria-labelledby="charts-heading">
            <h2 id="charts-heading" className="text-lg font-semibold">
              Progress
            </h2>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <CountChart
                title="Funnel: how far applications got"
                rows={charts.funnel}
                percentOf={apps.length}
                emptyText="No applications yet."
              />
              <CountChart
                title="Applications submitted per week (last 8 weeks)"
                rows={charts.weekly}
                emptyText="No submitted applications in the last 8 weeks."
              />
              <CountChart
                title="Coffee chats per month (last 6 months)"
                rows={charts.monthly}
                emptyText="No dated coffee chats in the last 6 months."
              />
              <CountChart
                title="Interviews by application source"
                rows={charts.bySource}
                emptyText="No interviews yet."
              />
            </div>
          </section>

          {/* 4. Applications */}
          <section className="mt-8" aria-labelledby="apps-heading">
            <h2 id="apps-heading" className="text-lg font-semibold">
              Applications
            </h2>
            <div className="mb-4 mt-3 max-w-md">
              <label htmlFor="tracker-search">Search company, role or notes</label>
              <input
                id="tracker-search"
                type="search"
                value={search}
                placeholder="e.g. Google, internship, referral…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {apps.length === 0 ? (
              <p className="text-muted-foreground">
                No applications yet. Save a listing to get started.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">No items match “{search}”.</p>
            ) : (
              <ul className="space-y-4">
                {filtered.map((a) => (
                  <TrackerRow key={a.id} app={a} today={today} onChanged={refresh} />
                ))}
              </ul>
            )}
          </section>

          <CoffeeChatSection chats={chats} onChanged={refresh} />

          <GmailSection suggestions={suggestions} onChanged={refresh} />

          <section className="card mt-6 p-5" aria-labelledby="insights">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="insights" className="text-lg font-semibold">
                AI advice
              </h2>
              <button className="btn" disabled={adviceBusy} onClick={runAdvice}>
                {adviceBusy ? "Thinking…" : "Get AI advice"}
              </button>
            </div>
            {adviceError && (
              <p role="alert" className="field-error mt-3">
                {adviceError}
              </p>
            )}
            {advice && (
              <div className="mt-4">
                <p className="text-sm leading-relaxed">{advice.advice}</p>
                {advice.resources.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {advice.resources.map((r) => (
                      <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                        <span className="font-medium">{r.title}</span>
                        {r.tag && (
                          <span className="ml-2 text-xs text-muted-foreground">{r.tag}</span>
                        )}
                        {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs underline"
                          >
                            Open resource
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </>
      )}
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
    </>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "border-destructive/50" : ""}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onChanged,
}: {
  suggestion: EmailSuggestion;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const act = async (state: "accepted" | "dismissed") => {
    setBusy(true);
    try {
      await updateEmailSuggestion({ data: { id: suggestion.id, state } });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <p>
        <span className="font-medium">{suggestion.company ?? "Unknown company"}</span>
        {suggestion.role ? ` — ${suggestion.role}` : ""}
        {suggestion.email_type && (
          <span className="ml-2 text-xs text-muted-foreground">{suggestion.email_type}</span>
        )}
      </p>
      {suggestion.evidence && (
        <p className="mt-1 text-xs text-muted-foreground">“{suggestion.evidence}”</p>
      )}
      <div className="mt-2 flex gap-2">
        <button className="btn btn-sm" disabled={busy} onClick={() => act("accepted")}>
          Accept
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => act("dismissed")}>
          Dismiss
        </button>
      </div>
    </li>
  );
}

function TrackerRow({
  app,
  today,
  onChanged,
}: {
  app: TrackerApplication;
  today: string;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(app.notes);
  const [nextAction, setNextAction] = useState(app.next_action ?? "");
  const nextDirty = nextAction !== (app.next_action ?? "");
  const nextOverdue =
    !!app.next_action_date &&
    app.next_action_date < today &&
    app.status !== "rejected" &&
    app.status !== "withdrawn";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const dirty = notes !== app.notes;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`card p-5 ${nextOverdue ? "border-destructive/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          className="text-left"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          title="Show status history"
        >
          <p className="text-lg font-semibold hover:underline">{app.role}</p>
          <p className="text-sm text-muted-foreground">{app.company}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved {new Date(app.created_at).toLocaleDateString()}
            {app.applied_date ? ` · Applied ${app.applied_date}` : ""}
          </p>
        </button>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`src-${app.id}`}>Source</label>
            <select
              id={`src-${app.id}`}
              value={app.source}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerApplication({
                    data: { id: app.id, source: e.target.value as never },
                  }),
                )
              }
            >
              {TRACKER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`st-${app.id}`}>Status</label>
            <select
              id={`st-${app.id}`}
              value={app.status}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerStatus({ data: { id: app.id, status: e.target.value as never } }),
                )
              }
            >
              {TRACKER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`ad-${app.id}`}>Applied date</label>
            <input
              id={`ad-${app.id}`}
              type="date"
              value={app.applied_date ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerApplication({
                    data: { id: app.id, applied_date: e.target.value || null },
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`na-${app.id}`}>Next action</label>
          <div className="flex gap-2">
            <input
              id={`na-${app.id}`}
              value={nextAction}
              maxLength={300}
              placeholder="e.g. Finish online test"
              onChange={(e) => setNextAction(e.target.value)}
            />
            <button
              className="btn btn-sm"
              disabled={!nextDirty || busy}
              onClick={() =>
                run(() =>
                  updateTrackerApplication({
                    data: { id: app.id, next_action: nextAction.trim() },
                  }),
                )
              }
            >
              Save
            </button>
          </div>
        </div>
        <div>
          <label htmlFor={`nad-${app.id}`}>Next action date</label>
          <input
            id={`nad-${app.id}`}
            type="date"
            value={app.next_action_date ?? ""}
            disabled={busy}
            onChange={(e) =>
              run(() =>
                updateTrackerApplication({
                  data: { id: app.id, next_action_date: e.target.value || null },
                }),
              )
            }
          />
        </div>
      </div>
      {nextOverdue && (
        <p className="mt-2 text-xs text-destructive">
          Next action overdue since {app.next_action_date}
        </p>
      )}
      <div className="mt-4">
        <label htmlFor={`n-${app.id}`}>Notes</label>
        <textarea
          id={`n-${app.id}`}
          rows={2}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            className="btn btn-sm"
            disabled={!dirty || busy}
            onClick={() => run(() => updateTrackerApplication({ data: { id: app.id, notes } }))}
          >
            Save notes
          </button>
          {error && (
            <span role="alert" className="field-error">
              {error}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          className="text-xs underline"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
        >
          {showHistory ? "Hide status history" : "Show status history"}
        </button>
        <button
          className="text-xs underline hover:text-destructive"
          disabled={busy}
          onClick={() => {
            if (confirm("Remove this application from your tracker?"))
              run(() => removeTrackerApplication({ data: { id: app.id } }));
          }}
        >
          Remove
        </button>
      </div>
      {showHistory && <StatusHistory applicationId={app.id} />}
    </li>
  );
}

function StatusHistory({ applicationId }: { applicationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tracker-events", applicationId],
    queryFn: () => listTrackerEvents({ data: { applicationId } }),
  });
  if (isLoading) return <p className="mt-2 text-xs text-muted-foreground">Loading history…</p>;
  const events = (data ?? []) as TrackerEvent[];
  if (events.length === 0)
    return <p className="mt-2 text-xs text-muted-foreground">No status changes recorded yet.</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
      {events.map((e) => (
        <li key={e.id}>
          {new Date(e.date).toLocaleString()} — {STATUS_LABEL[e.status] ?? e.status}
          {e.source === "gmail" ? " (from Gmail)" : ""}
        </li>
      ))}
    </ul>
  );
}

function CoffeeChatSection({
  chats,
  onChanged,
  children,
}: {
  chats: CoffeeChat[];
  onChanged: () => void;
  children?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");
<<<<<<< src/routes/_authenticated/tracker.tsx
  const [referral, setReferral] = useState<"" | "yes" | "no">("");
  const [comment, setComment] = useState("");
  const [followUp, setFollowUp] = useState(false);
=======
  const [followUp, setFollowUp] = useState("");
  const [followUpTouched, setFollowUpTouched] = useState(false);
  const [referral, setReferral] = useState("no");
  const [comments, setComments] = useState("");
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    let followUpDate: string | null = null;
    if (followUp) {
      const base = date ? new Date(`${date}T00:00:00`) : new Date();
      base.setDate(base.getDate() + 21);
      followUpDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    }
    try {
      await saveCoffeeChat({
        data: {
          contact_name: name.trim(),
          company: company.trim(),
          date: date || null,
<<<<<<< src/routes/_authenticated/tracker.tsx
          follow_up_date: followUpDate,
=======
          follow_up_date: followUp || null,
          referral: referral === "yes",
          notes: comments,
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
          outcome: "planned",
          referral: referral === "" ? null : referral === "yes",
          notes: comment.trim(),
        },
      });
      setName("");
      setCompany("");
      setDate("");
<<<<<<< src/routes/_authenticated/tracker.tsx
      setReferral("");
      setComment("");
      setFollowUp(false);
=======
      setFollowUp("");
      setFollowUpTouched(false);
      setReferral("no");
      setComments("");
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="chats-heading">
      <h2 id="chats-heading" className="text-lg font-semibold">
        Coffee chats
      </h2>
      <div className="card mt-2 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="cc-name">Contact name</label>
            <input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Lee"
            />
          </div>
          <div>
            <label htmlFor="cc-company">Company</label>
            <input
              id="cc-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="cc-date">Chat date</label>
            <input
              id="cc-date"
              type="date"
              value={date}
              onChange={(e) => {
                const v = e.target.value;
                setDate(v);
                if (!followUpTouched) setFollowUp(v ? defaultFollowUpDate(v) : "");
              }}
            />
          </div>
          <div>
<<<<<<< src/routes/_authenticated/tracker.tsx
            <label htmlFor="cc-ref">Referral?</label>
            <select
              id="cc-ref"
              value={referral}
              onChange={(e) => setReferral(e.target.value as "" | "yes" | "no")}
            >
              <option value="">Not yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label htmlFor="cc-follow">Follow up?</label>
            <select
              id="cc-follow"
              value={followUp ? "yes" : "no"}
              onChange={(e) => setFollowUp(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes — remind me in 21 days</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cc-comment">Comment</label>
            <textarea
              id="cc-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How did it go? What did you learn? AI can analyse this later."
            />
          </div>
=======
            <label htmlFor="cc-followup">Follow-up date</label>
            <input
              id="cc-followup"
              type="date"
              value={followUp}
              onChange={(e) => {
                setFollowUp(e.target.value);
                setFollowUpTouched(true);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults to 21 days after the chat.
            </p>
          </div>
          <div>
            <label htmlFor="cc-referral">Referral</label>
            <select id="cc-referral" value={referral} onChange={(e) => setReferral(e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="cc-notes">Comments</label>
          <textarea
            id="cc-notes"
            rows={2}
            maxLength={5000}
            value={comments}
            placeholder="How did it go? Anything the advisor should know?"
            onChange={(e) => setComments(e.target.value)}
          />
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-sm" disabled={busy || !name.trim()} onClick={add}>
            Add coffee chat
          </button>
          {error && (
            <span role="alert" className="field-error">
              {error}
            </span>
          )}
        </div>
      </div>
<<<<<<< src/routes/_authenticated/tracker.tsx
      {children}
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
=======
      {chats.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No coffee chats yet. Add one above and track how it goes.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {chats.map((c) => (
            <CoffeeChatRow key={c.id} chat={c} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CoffeeChatRow({ chat, onChanged }: { chat: CoffeeChat; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState(chat.notes);
  const commentsDirty = comments !== chat.notes;
  const today = todayIso();
  const overdue = chat.follow_up_date && !chat.follow_up_done && chat.follow_up_date < today;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (fields: {
    follow_up_date?: string | null;
    referral?: boolean;
    notes?: string;
    outcome?: "" | (typeof COFFEE_CHAT_OUTCOMES)[number];
  }) =>
    saveCoffeeChat({
      data: {
        id: chat.id,
        contact_name: chat.contact_name,
        company: chat.company,
        date: chat.date,
        follow_up_date: chat.follow_up_date,
        referral: chat.referral ?? false,
        notes: chat.notes,
        outcome: chat.outcome,
        ...fields,
      },
    });

  return (
    <li className={`card p-4 ${overdue ? "border-destructive/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
        <div>
          <h3 className="text-base font-semibold">Coffee chat history</h3>
          <p className="text-sm text-muted-foreground">
            {chats.length === 0
              ? "No coffee chats logged yet."
              : `${chats.length} coffee chat${chats.length === 1 ? "" : "s"} logged — update outcomes, follow-ups and referrals there.`}
          </p>
        </div>
<<<<<<< src/routes/_authenticated/tracker.tsx
        <Link to="/coffee-chats" className="btn btn-outline btn-sm">
          View history →
        </Link>
=======
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`cc-out-${chat.id}`}>Outcome</label>
            <select
              id={`cc-out-${chat.id}`}
              value={chat.outcome}
              disabled={busy}
              onChange={(e) => run(() => patch({ outcome: e.target.value as never }))}
            >
              <option value="">—</option>
              {COFFEE_CHAT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`cc-ref-${chat.id}`}>Referral</label>
            <select
              id={`cc-ref-${chat.id}`}
              value={chat.referral ? "yes" : "no"}
              disabled={busy}
              onChange={(e) => run(() => patch({ referral: e.target.value === "yes" }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div>
            <label htmlFor={`cc-fu-${chat.id}`}>Follow-up date</label>
            <input
              id={`cc-fu-${chat.id}`}
              type="date"
              value={chat.follow_up_date ?? ""}
              disabled={busy}
              onChange={(e) => run(() => patch({ follow_up_date: e.target.value || null }))}
            />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor={`cc-notes-${chat.id}`}>Comments</label>
        <textarea
          id={`cc-notes-${chat.id}`}
          rows={2}
          maxLength={5000}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            className="btn btn-sm"
            disabled={!commentsDirty || busy}
            onClick={() => run(() => patch({ notes: comments }))}
          >
            Save comments
          </button>
        </div>
      </div>
      {overdue && (
        <p className="mt-2 text-xs text-destructive">
          Follow-up overdue since {chat.follow_up_date}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {error && (
          <span role="alert" className="field-error">
            {error}
          </span>
        )}
        {chat.follow_up_date &&
          (chat.follow_up_done ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              Follow-up done
              <button
                className="underline"
                disabled={busy}
                onClick={() =>
                  run(() => setCoffeeChatFollowUpDone({ data: { id: chat.id, done: false } }))
                }
              >
                Undo
              </button>
            </span>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() =>
                run(() => setCoffeeChatFollowUpDone({ data: { id: chat.id, done: true } }))
              }
            >
              Mark follow-up done
            </button>
          ))}
        <button
          className="ml-auto text-xs underline hover:text-destructive"
          disabled={busy}
          onClick={() => {
            if (confirm("Remove this coffee chat?"))
              run(() => deleteCoffeeChat({ data: { id: chat.id } }));
          }}
        >
          Remove
        </button>
>>>>>>> /tmp/m/src_routes__authenticated_tracker.tsx.d
      </div>
    </section>
  );
}


function GmailSection({
  suggestions,
  onChanged,
}: {
  suggestions: EmailSuggestion[];
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["gmail-status"], queryFn: () => gmailStatus() });
  const status = statusQuery.data;
  const [busy, setBusy] = useState<"connect" | "scan" | "disconnect" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ["gmail-status"] });

  const connect = async () => {
    setError("");
    setNote("");
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) {
      setError("Popup blocked. Allow popups and try again.");
      return;
    }
    setBusy("connect");
    try {
      const { authorizationUrl } = await startGmailConnect();
      const code = await new Promise<string | null>((resolve, reject) => {
        let poll: number | undefined;
        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          if (poll !== undefined) window.clearInterval(poll);
        };
        const onMessage = (event: MessageEvent) => {
          const type = event.data?.type;
          if (
            event.origin !== window.location.origin ||
            event.source !== popup ||
            event.data?.connectorId !== "google_mail" ||
            (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
          )
            return;
          cleanup();
          if (type === "appUserConnectorOAuthComplete") {
            resolve(typeof event.data?.code === "string" ? event.data.code : null);
            return;
          }
          popup.close();
          reject(new Error("The Gmail connection did not complete."));
        };
        window.addEventListener("message", onMessage);
        poll = window.setInterval(() => {
          if (!popup.closed) return;
          cleanup();
          reject(new Error("The sign-in window was closed before finishing."));
        }, 500);
      });
      popup.location.href = authorizationUrl;
      const finishedCode = await code;
      if (finishedCode) await completeGmailConnection({ data: { code: finishedCode } });
      setNote("Gmail connected. You can scan your inbox now.");
      refreshStatus();
    } catch (err) {
      if (!popup.closed) popup.close();
      setError(err instanceof Error ? err.message : "Could not connect Gmail. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const scan = async () => {
    setBusy("scan");
    setError("");
    setNote("");
    try {
      const result = await scanGmailInbox();
      if (result.reconnectRequired) refreshStatus();
      setNote(result.message);
      if (result.found > 0) onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The scan failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError("");
    try {
      await disconnectGmail();
      setNote("Gmail disconnected. Nothing is read from your inbox anymore.");
      refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const connected = status?.connected === true;
  const reconnect = status?.reconnectRequired === true;

  return (
    <section className="card mt-8 p-5" aria-labelledby="gmail-scan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gmail-scan" className="text-lg font-semibold">
          Gmail updates
        </h2>
        <div className="flex gap-2">
          {connected ? (
            <>
              <button className="btn" disabled={busy !== null} onClick={scan}>
                {busy === "scan" ? "Scanning…" : "Scan my inbox"}
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={disconnect}
              >
                {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : (
            <button className="btn" disabled={busy !== null} onClick={connect}>
              {busy === "connect" ? "Connecting…" : reconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {connected
          ? `Reading ${status?.inboxEmail ?? "your inbox"} (read-only). Scanning suggests status updates for you to accept or dismiss — nothing changes automatically.`
          : reconnect
            ? "Your Gmail access needs to be renewed. Reconnect to keep scanning."
            : "Connect your Gmail to get status-update suggestions from your inbox. Read-only: we never send, delete or change your email."}
      </p>
      <PassportEmailNote inboxEmail={connected ? status?.inboxEmail : null} />
      {error && (
        <p role="alert" className="field-error mt-3">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="mt-3 text-sm text-success">
          {note}
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Inbox suggestions">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PassportEmailNote({ inboxEmail }: { inboxEmail?: string | null | undefined }) {
  const { profile } = useStore();
  const email = normalizeEmail(profile?.email);
  const status = emailMatchState(email, inboxEmail);
  return (
    <p className="mt-3 text-sm">
      {!email && profile?.emailTrackingOptOut ? (
        <>
          You chose not to have your email tracked.{" "}
          <Link to="/passport" className="underline">
            Change this in your Passport
          </Link>
          .
        </>
      ) : status === "missing" ? (
        <>
          No email in your Passport yet.{" "}
          <Link to="/passport" className="underline">
            Add it in your Passport
          </Link>{" "}
          — when Gmail is connected we'll check it's the same inbox.
        </>
      ) : status === "mismatch" ? (
        <>
          <span role="alert" className="text-destructive">
            Heads up: your connected inbox ({inboxEmail}) is different from your Passport email (
            {email}). Scanning reads the connected inbox.
          </span>
        </>
      ) : status === "match" ? (
        <>
          Connected inbox matches your Passport email: <span className="font-medium">{email}</span>.
        </>
      ) : (
        <>
          Inbox to use: <span className="font-medium">{email}</span> (from your Passport). When
          you connect Gmail, we'll warn you if it's a different account.
        </>
      )}
    </p>
  );
}
