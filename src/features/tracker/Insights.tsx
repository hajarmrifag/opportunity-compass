import { useMemo, useState } from "react";
import type { AdviceResult, CoffeeChat, TrackerApplication } from "@/lib/tracker.functions";

import { Button } from "@/components/ui/button";
import { ChartPie, Sparkles } from "lucide-react";

const BUCKETS = [
  { key: "saved", label: "Saved", color: "var(--muted-foreground)" },
  { key: "preparing", label: "Preparing", color: "var(--navy)" },
  { key: "submitted", label: "Submitted", color: "var(--primary)" },
  { key: "assessment", label: "Assessment", color: "var(--demo)" },
  { key: "interview", label: "Interview", color: "var(--warning-strong)" },
  { key: "offer", label: "Offer", color: "var(--success)" },
  { key: "rejected", label: "Rejected", color: "var(--destructive)" },
  { key: "withdrawn", label: "Withdrawn", color: "var(--vermilion)" },
];

function StatusDonut({ apps }: { apps: TrackerApplication[] }) {
  const total = apps.length;
  const circumference = 2 * Math.PI * 86;
  let offset = 0;
  const segments = BUCKETS.map((bucket) => {
    const count = apps.filter((app) => app.status === bucket.key).length;
    const length = total ? (count / total) * circumference : 0;
    const segment = { ...bucket, count, length, offset };
    offset += length;
    return segment;
  });

  return (
    <div>
      <svg
        viewBox="0 0 240 240"
        className="mx-auto w-full max-w-64"
        role="img"
        aria-label={`Application status chart: ${total} tracked applications. ${segments.map((s) => `${s.label}: ${s.count}`).join(", ")}`}
      >
        <circle cx="120" cy="120" r="86" fill="none" stroke="var(--muted)" strokeWidth="28" />
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <circle
              key={s.key}
              cx="120"
              cy="120"
              r="86"
              fill="none"
              stroke={s.color}
              strokeWidth="28"
              strokeDasharray={`${s.length} ${circumference - s.length}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 120 120)"
            >
              <title>
                {s.label}: {s.count} ({Math.round((s.count / total) * 100)}%)
              </title>
            </circle>
          ))}
        <text
          x="120"
          y="117"
          textAnchor="middle"
          className="fill-foreground text-3xl font-semibold"
        >
          {total}
        </text>
        <text x="120" y="140" textAnchor="middle" className="fill-muted-foreground text-xs">
          Applications
        </text>
      </svg>
      <ul
        className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm"
        aria-label="Application status totals"
      >
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <svg width="10" height="10" aria-hidden="true" className="shrink-0">
              <circle cx="5" cy="5" r="5" fill={s.color} />
            </svg>
            <span>{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
      {total === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No applications tracked yet.</p>
      )}
    </div>
  );
}

const DEMO_COURSES = [
  {
    title: "How to run an effective coffee chat",
    tag: "Networking",
    notes:
      "Prepare 3 questions, keep it to 20 minutes, ask who else to talk to, follow up within 48h.",
  },
  {
    title: "Turning a coffee chat into a referral",
    tag: "Referrals",
    notes: "When and how to ask, and what to send so the referrer can act quickly.",
  },
  {
    title: "From application to first interview",
    tag: "Applications",
    notes: "Tailoring your CV to each listing and tracking which versions get responses.",
  },
];

export function TrackerInsights({
  apps,
  chats,
  suggestionsCount,
  onAdvice,
}: {
  apps: TrackerApplication[];
  chats: CoffeeChat[];
  suggestionsCount: number;
  onAdvice: () => Promise<AdviceResult>;
}) {
  const [showGraph, setShowGraph] = useState(true);
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const rejected = useMemo(() => apps.filter((app) => app.status === "rejected"), [apps]);

  const runAdvice = async () => {
    setBusy(true);
    setPreview(false);
    try {
      setAdvice(await onAdvice());
    } catch {
      setAdvice(null);
      setPreview(true);
    } finally {
      setBusy(false);
    }
  };

  const referrals = chats.filter((c) => c.referral === true).length;

  return (
    <section className="card mt-6 p-5" aria-labelledby="insights">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="insights" className="text-lg font-semibold">
            Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Current tracked statuses · refreshes every 15 seconds while this page is open.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowGraph((v) => !v)}
            aria-expanded={showGraph}
            aria-controls="tracker-graphs"
          >
            <ChartPie aria-hidden="true" />
            {showGraph ? "Hide chart" : "Show chart"}
          </Button>
          <Button disabled={busy} onClick={runAdvice}>
            <Sparkles aria-hidden="true" />
            {busy ? "Thinking…" : "AI feedback"}
          </Button>
        </div>
      </div>

      {showGraph && (
        <div id="tracker-graphs" className="mt-5" aria-live="polite">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Application outcomes</h3>
              <StatusDonut apps={apps} />
            </div>
            <div className="min-w-0 lg:border-l lg:border-border lg:pl-8">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Rejected applications</h3>
                <span className="text-sm font-semibold text-destructive">{rejected.length}</span>
              </div>
              {rejected.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No rejections recorded.</p>
              ) : (
                <ul
                  className="mt-3 max-h-96 overflow-y-auto divide-y divide-border"
                  aria-label="Rejected internships and other applications"
                >
                  {rejected.map((app) => (
                    <li key={app.id} className="py-3">
                      <p className="break-words text-sm font-semibold">{app.role}</p>
                      <p className="break-words text-sm text-muted-foreground">{app.company}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Status updated {new Date(app.updated_at).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
            Gmail is not connected.{" "}
            {suggestionsCount > 0
              ? `${suggestionsCount} pending email suggestions are excluded from these counts. `
              : ""}
            Coffee chats: {chats.length} · Referrals: {referrals}
          </p>
        </div>
      )}

      {advice && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed">{advice.advice}</p>
          {advice.resources.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {advice.resources.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{r.title}</span>
                  {r.tag && <span className="ml-2 text-xs text-muted-foreground">{r.tag}</span>}
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

      {preview && (
        <div className="mt-4">
          <p className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Preview — AI feedback isn't connected yet. Example output below.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            You have {apps.length} tracked application(s) and {chats.length} coffee chat(s). Once AI
            is connected, feedback here will be based on those numbers and the comments you leave on
            each chat.
          </p>
          <h3 className="mt-3 text-sm font-semibold">Recommended courses (demo listing)</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {DEMO_COURSES.map((c) => (
              <li key={c.title} className="rounded-md border border-border p-3 text-sm">
                <span className="font-medium">{c.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.tag} · Demo</span>
                <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
