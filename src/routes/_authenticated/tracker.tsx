import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { emailMatchState, normalizeEmail } from "@/lib/profileExtraction";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TRACKER_SOURCES,
  TRACKER_STATUSES,
  generateAdvice,
  listCoffeeChats,
  listEmailSuggestions,
  listTrackerApplications,
  listTrackerEvents,
  removeTrackerApplication,
  saveCoffeeChat,
  updateEmailSuggestion,
  updateTrackerApplication,
  updateTrackerStatus,
  type AdviceResult,
  type CoffeeChat,
  type EmailSuggestion,
  type TrackerApplication,
  type TrackerEvent,
} from "@/lib/tracker.functions";
import {
  completeGmailConnection,
  disconnectGmail,
  gmailStatus,
  scanGmailInbox,
  startGmailConnect,
} from "@/lib/gmail.functions";
import { TrackerInsights } from "@/features/tracker/Insights";
import { CoffeeChatRow, todayIso } from "@/features/tracker/CoffeeChatRow";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({
    meta: [
      { title: "Tracker · Sourced" },
      {
        name: "description",
        content:
          "Your career dashboard: applications, coffee chats, follow-ups and honest AI advice.",
      },
      { property: "og:title", content: "Tracker · Sourced" },
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
  const suggestionsQuery = useQuery({
    queryKey: ["email-suggestions"],
    queryFn: () => listEmailSuggestions(),
    refetchInterval: 15_000,
  });
  const apps = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);
  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);
  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tracker-applications"] });
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
      // Any chat dated this calendar month (or logged this month without a date).
      chatsThisMonth: chats.filter((c) =>
        c.date ? c.date.slice(0, 7) === monthKey : c.created_at.slice(0, 7) === monthKey,
      ).length,
      // Overdue or due within the next 7 days.
      followUpsDue: chats.filter((c) => c.follow_up_date && c.follow_up_date <= weekAhead).length,
    };
  }, [apps, chats, monthKey, weekAhead]);

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

  return (
    <>
      <PageHeader
        kicker="Account"
        title="Tracker"
        sub="Applications, coffee chats, and inbox updates from the Gmail you connect. My Journey stays separate in this browser."
        right={
          <div className="flex flex-wrap gap-2">
            <a href="#gmail-scan" className="btn btn-outline">
              Gmail
            </a>
            <Link to="/resources" className="btn btn-ghost">
              Resources
            </Link>
          </div>
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
        <GmailSection suggestions={suggestions} lastEmailUpdate={lastEmailUpdate} onChanged={refresh} />

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
  const [referral, setReferral] = useState<"" | "yes" | "no">("");
  const [comment, setComment] = useState("");
  const [followUp, setFollowUp] = useState(false);
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
          follow_up_date: followUpDate,
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
      setFollowUp(false);
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
      {children}
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="text-base font-semibold">Coffee chat history</h3>
          <p className="text-sm text-muted-foreground">
            {chats.length === 0
              ? "No coffee chats logged yet."
              : `${chats.length} coffee chat${chats.length === 1 ? "" : "s"} logged — update outcomes, follow-ups and referrals there.`}
          </p>
        </div>
        <Link to="/coffee-chats" className="btn btn-outline btn-sm">
          View history →
        </Link>
      </div>
    </section>
  );
}

function GmailSection({
  suggestions,
  lastEmailUpdate,
  onChanged,
}: {
  suggestions: EmailSuggestion[];
  lastEmailUpdate: string | null | undefined;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["gmail-status"], queryFn: () => gmailStatus() });
  const status = statusQuery.data;
  const [busy, setBusy] = useState<"connect" | "scan" | "disconnect" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ["gmail-status"] });

  // Fallback: the sign-in window landed back here with a code because it
  // couldn't reach the original page. Finish the connection in this window.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("gmail_code");
    if (!code) return;
    params.delete("gmail_code");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    setBusy("connect");
    completeGmailConnection({ data: { code } })
      .then(() => {
        setNote("Gmail connected. Checking your inbox for updates…");
        refreshStatus();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not finish connecting Gmail."))
      .finally(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      popup.location.href = authorizationUrl;
      const code = await new Promise<string | null>((resolve, reject) => {
        // Google's sign-in page can cut the link between this page and the
        // popup, so also listen on a same-origin channel and don't treat a
        // "closed" reading as failure (it can be wrong after Google).
        const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gmail-oauth") : null;
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("The Google sign-in took too long. Please try again."));
        }, 5 * 60 * 1000);
        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          channel?.close();
          window.clearTimeout(timeout);
        };
        const handle = (data: any) => {
          const type = data?.type;
          if (
            data?.connectorId !== "google_mail" ||
            (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
          )
            return false;
          channel?.postMessage({ type: "ack" });
          cleanup();
          if (type === "appUserConnectorOAuthComplete") {
            resolve(typeof data?.code === "string" ? data.code : null);
          } else {
            reject(new Error("The Gmail connection did not complete."));
          }
          return true;
        };
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          handle(event.data);
        };
        window.addEventListener("message", onMessage);
        if (channel) channel.onmessage = (e) => handle(e.data);
      });
      const finishedCode = await code;
      if (finishedCode) await completeGmailConnection({ data: { code: finishedCode } });
      setNote("Gmail connected. Checking your inbox for updates…");
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
  const autoScanned = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (!autoScanned.current) {
      autoScanned.current = true;
      void scan().then(onChanged);
    }
    // Keep checking every 10 minutes while the Tracker is open.
    const timer = window.setInterval(() => void scan().then(onChanged), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <section className="atlas-gmail mt-8" aria-labelledby="gmail-scan">
      <div className="atlas-gmail-head">
        <div>
          <p className="atlas-kicker">Inbox</p>
          <h2 id="gmail-scan">Gmail</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <button className="btn btn-ghost" disabled={busy !== null} onClick={disconnect}>
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <button className="btn" disabled={busy !== null} onClick={connect}>
              {busy === "connect" ? "Connecting…" : reconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </button>
          )}
        </div>
      </div>
      <p className="atlas-gmail-deck">
        {connected
          ? `Reading ${status?.inboxEmail ?? "your inbox"} (read-only). Clear emails from companies (confirmations, assessments, interviews, offers, rejections) update the matching application. Unclear ones wait for you below. Checked when you open Tracker, and every 10 minutes while it is open.`
          : reconnect
            ? "Your Gmail access needs to be renewed. Reconnect to keep updates coming."
            : "Connect Gmail and company emails can move a matching application forward. Read-only: we never send, delete, or change your mail."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {busy === "scan"
          ? "Checking your inbox…"
          : lastEmailUpdate
            ? `Last updated ${new Date(lastEmailUpdate).toLocaleString()}`
            : connected
              ? "Last updated: no email results yet."
              : "Last updated: never. Gmail is not connected yet."}
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
          so when Gmail is connected we can check it is the same inbox.
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
