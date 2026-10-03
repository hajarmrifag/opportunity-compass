import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COFFEE_CHAT_OUTCOMES,
  TRACKER_SOURCES,
  TRACKER_STATUSES,
  deleteCoffeeChat,
  generateAdvice,
  listCoffeeChats,
  listEmailSuggestions,
  listTrackerApplications,
  listTrackerEvents,
  removeTrackerApplication,
  saveCoffeeChat,
  scanGmail,
  updateEmailSuggestion,
  updateTrackerApplication,
  updateTrackerStatus,
  type AdviceResult,
  type CoffeeChat,
  type EmailSuggestion,
  type TrackerApplication,
  type TrackerEvent,
} from "@/lib/tracker.functions";
import { TrackerInsights } from "@/features/tracker/Insights";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({
    meta: [
      { title: "Tracker — OpportunityOS" },
      {
        name: "description",
        content:
          "Your career dashboard: applications, coffee chats, follow-ups and honest AI advice.",
      },
      { property: "og:title", content: "Tracker — OpportunityOS" },
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

const OUTCOME_LABEL: Record<string, string> = {
  planned: "Planned",
  responded: "Responded",
  ghosted: "Ghosted",
  follow_up_ghosted: "Followed up, then ghosted",
  successful_referral: "Successful referral",
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const suggestionsQuery = useQuery({
    queryKey: ["email-suggestions"],
    queryFn: () => listEmailSuggestions(),
    refetchInterval: 15_000,
  });
  const [search, setSearch] = useState("");
  const [scanMessage, setScanMessage] = useState("");

  const apps = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);
  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);
  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tracker-applications"] });
    queryClient.invalidateQueries({ queryKey: ["coffee-chats"] });
    queryClient.invalidateQueries({ queryKey: ["email-suggestions"] });
  };

  const today = todayIso();
  const monthStart = today.slice(0, 8) + "01";

  const counts = useMemo(() => {
    const byStatus = (s: string) => apps.filter((a) => a.status === s).length;
    return {
      submitted: byStatus("submitted"),
      assessments: byStatus("assessment"),
      interviews: byStatus("interview"),
      offers: byStatus("offer"),
      rejections: byStatus("rejected"),
      chatsThisMonth: chats.filter((c) => c.date && c.date >= monthStart && c.date <= today).length,
      followUpsDue: chats.filter((c) => c.follow_up_date && c.follow_up_date <= today).length,
    };
  }, [apps, chats, monthStart, today]);

  const dueToday = useMemo(
    () => chats.filter((c) => c.follow_up_date && c.follow_up_date <= today),
    [chats, today],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) =>
      [a.company, a.role, a.notes].some((field) => field.toLowerCase().includes(q)),
    );
  }, [apps, search]);

  const runScan = async () => {
    const result = await scanGmail();
    setScanMessage(result.message);
  };

  if (appsQuery.isLoading || chatsQuery.isLoading) return <Loading />;


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
      {(appsQuery.error || chatsQuery.error) && (
        <p role="alert" className="field-error mb-4">
          Could not load your tracker:{" "}
          {((appsQuery.error ?? chatsQuery.error) as Error).message ?? "Unknown error"}
        </p>
      )}

      {/* 1. Summary cards — counted from the database, never AI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Submitted" value={counts.submitted} />
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

      <>
          {/* 2. Due today */}
          <section className="card mt-6 p-5" aria-labelledby="due-today">
            <h2 id="due-today" className="text-lg font-semibold">
              Due today
            </h2>
            {dueToday.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                No follow-ups due. Set a follow-up date on a coffee chat and it appears here.
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
                    <span className="font-medium">{c.contact_name}</span>
                    {c.company ? ` · ${c.company}` : ""}
                    <span className="ml-2 text-xs text-muted-foreground">
                      Follow-up{" "}
                      {c.follow_up_date === today
                        ? "due today"
                        : `overdue since ${c.follow_up_date}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Gmail scan */}
          <section className="card mt-6 p-5" aria-labelledby="gmail-scan">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="gmail-scan" className="text-lg font-semibold">
                  Gmail updates
                </h2>
                <p className="text-sm text-muted-foreground">
                  Scanning proposes status updates from your mailbox. You accept or dismiss each one
                  — nothing changes automatically.
                </p>
              </div>
              <button className="btn btn-outline" onClick={runScan}>
                Scan my Gmail
              </button>
            </div>
            {scanMessage && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {scanMessage}
              </p>
            )}
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
            <div className="mb-4 mt-2 max-w-md">
              <label htmlFor="tracker-search">Search company, role or notes</label>
              <input
                id="tracker-search"
                type="search"
                value={search}
                placeholder="e.g. Google, internship, referral…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filtered.length === 0 ? (
              <p className="text-muted-foreground">No items match “{search}”.</p>
            ) : (
              <ul className="space-y-4">
                {filtered.map((a) => (
                  <TrackerRow key={a.id} app={a} onChanged={refresh} />
                ))}
              </ul>
            )}
          </section>
      </>

      {/* Coffee chats — always available, even before anything is tracked */}
      <CoffeeChatSection chats={chats} onChanged={refresh} />

      {/* Insights: AI feedback */}
      <TrackerInsights apps={apps} chats={chats} onAdvice={() => generateAdvice()} />
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

function TrackerRow({ app, onChanged }: { app: TrackerApplication; onChanged: () => void }) {
  const [notes, setNotes] = useState(app.notes);
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
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{app.role}</p>
          <p className="text-sm text-muted-foreground">{app.company}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved {new Date(app.created_at).toLocaleDateString()}
            {app.applied_date ? ` · Applied ${app.applied_date}` : ""}
          </p>
        </div>
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

function CoffeeChatSection({ chats, onChanged }: { chats: CoffeeChat[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");
  const [referral, setReferral] = useState<"" | "yes" | "no">("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await saveCoffeeChat({
        data: {
          contact_name: name.trim(),
          company: company.trim(),
          date: date || null,
          outcome: "planned",
          referral: referral === "" ? null : referral === "yes",
          notes: comment.trim(),
        },
      });
      setName("");
      setCompany("");
      setDate("");
      setReferral("");
      setComment("");
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
        <div className="grid gap-3 sm:grid-cols-3">
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
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
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
  const today = todayIso();
  const overdue = chat.follow_up_date && chat.follow_up_date < today;

  const [comment, setComment] = useState(chat.notes);
  const [aiNote, setAiNote] = useState(false);
  const patch = (changes: Partial<CoffeeChat>) =>
    run(() =>
      saveCoffeeChat({
        data: {
          id: chat.id,
          contact_name: chat.contact_name,
          company: chat.company,
          date: chat.date,
          follow_up_date: chat.follow_up_date,
          notes: chat.notes,
          outcome: chat.outcome,
          referral: chat.referral ?? null,
          ...changes,
        } as never,
      }),
    );

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
    <li className={`card p-4 ${overdue ? "border-destructive/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{chat.contact_name}</p>
          <p className="text-sm text-muted-foreground">
            {chat.company || "No company"}
            {chat.date ? ` · Chatted ${chat.date}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`cc-out-${chat.id}`}>Outcome</label>
            <select
              id={`cc-out-${chat.id}`}
              value={chat.outcome}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  saveCoffeeChat({
                    data: {
                      id: chat.id,
                      contact_name: chat.contact_name,
                      company: chat.company,
                      date: chat.date,
                      follow_up_date: chat.follow_up_date,
                      notes: chat.notes,
                      outcome: e.target.value as never,
                    },
                  }),
                )
              }
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
            <label htmlFor={`cc-fu-${chat.id}`}>Follow-up date</label>
            <input
              id={`cc-fu-${chat.id}`}
              type="date"
              value={chat.follow_up_date ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  saveCoffeeChat({
                    data: {
                      id: chat.id,
                      contact_name: chat.contact_name,
                      company: chat.company,
                      date: chat.date,
                      follow_up_date: e.target.value || null,
                      notes: chat.notes,
                      outcome: chat.outcome,
                    },
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor={`cc-ref-${chat.id}`}>Referral?</label>
          <select
            id={`cc-ref-${chat.id}`}
            value={chat.referral === true ? "yes" : chat.referral === false ? "no" : ""}
            disabled={busy}
            onChange={(e) =>
              patch({ referral: e.target.value === "" ? null : e.target.value === "yes" })
            }
          >
            <option value="">Not yet</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label htmlFor={`cc-note-${chat.id}`}>Comment</label>
          <textarea
            id={`cc-note-${chat.id}`}
            rows={2}
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => comment !== chat.notes && patch({ notes: comment })}
            placeholder="How did it go? AI can analyse this later."
          />
          <button
            type="button"
            className="mt-1 text-xs underline"
            onClick={() => setAiNote((v) => !v)}
          >
            Analyse with AI
          </button>
          {aiNote && (
            <p role="status" className="mt-1 text-xs text-muted-foreground">
              AI comment analysis isn't connected yet — your comment is saved and will be analysed
              once it is.
            </p>
          )}
        </div>
      </div>
      {overdue && (
        <p className="mt-2 text-xs text-destructive">
          Follow-up overdue since {chat.follow_up_date}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        {error && (
          <span role="alert" className="field-error">
            {error}
          </span>
        )}
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
      </div>
    </li>
  );
}
