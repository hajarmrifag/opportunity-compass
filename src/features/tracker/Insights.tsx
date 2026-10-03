import { useMemo, useState } from "react";
import type { AdviceResult, CoffeeChat, TrackerApplication } from "@/lib/tracker.functions";

/**
 * Insights surface for the Tracker: a flow (Sankey-style) graph built from the
 * student's own applications, plus an AI feedback panel. When there is no
 * data / no AI connection yet, clearly labelled sample content is shown so the
 * surface can be reviewed now and wired to Gmail + AI later.
 */

type Bucket = { key: string; label: string; color: string };
const BUCKETS: Bucket[] = [
  { key: "pending", label: "Pending", color: "var(--chart-1, var(--primary))" },
  { key: "assessment", label: "Assessment", color: "var(--chart-2, var(--accent))" },
  { key: "interview", label: "Interview", color: "var(--chart-3, var(--primary))" },
  { key: "offer", label: "Offer", color: "var(--chart-4, var(--primary))" },
  { key: "rejected", label: "Rejected", color: "var(--destructive)" },
  { key: "withdrawn", label: "Withdrawn", color: "var(--muted-foreground)" },
];

function bucketOf(status: string): string {
  if (["assessment", "interview", "offer", "rejected", "withdrawn"].includes(status)) return status;
  return "pending";
}

const SAMPLE: Record<string, number> = {
  pending: 45,
  assessment: 9,
  interview: 12,
  offer: 1,
  rejected: 62,
  withdrawn: 3,
};

function FlowGraph({ counts }: { counts: Record<string, number> }) {
  const W = 640;
  const H = 360;
  const pad = 14;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = BUCKETS.filter((b) => (counts[b.key] ?? 0) > 0);
  const usable = H - pad * (rows.length + 1);
  const scale = total > 0 ? usable / total : 0;
  const srcX = 120;
  const dstX = W - 150;
  const srcTop = (H - total * scale) / 2;

  let srcCursor = srcTop;
  let dstCursor = pad;
  const links = rows.map((b) => {
    const h = Math.max(2, (counts[b.key] ?? 0) * scale);
    const s0 = srcCursor;
    const d0 = dstCursor;
    srcCursor += h;
    dstCursor += h + pad;
    const mid = (srcX + dstX) / 2;
    const path = `M${srcX},${s0} C${mid},${s0} ${mid},${d0} ${dstX},${d0} L${dstX},${d0 + h} C${mid},${d0 + h} ${mid},${s0 + h} ${srcX},${s0 + h} Z`;
    return { b, h, d0, path };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Application flow graph">
      {links.map(({ b, path }) => (
        <path key={b.key} d={path} fill={b.color} opacity={0.35} />
      ))}
      <rect x={srcX - 8} y={srcTop} width={8} height={total * scale} fill="var(--primary)" />
      <text x={srcX - 14} y={H / 2 - 4} textAnchor="end" className="fill-foreground text-[13px]">
        Applications
      </text>
      <text x={srcX - 14} y={H / 2 + 14} textAnchor="end" className="fill-foreground text-[15px] font-semibold">
        {total}
      </text>
      {links.map(({ b, h, d0 }) => (
        <g key={b.key}>
          <rect x={dstX} y={d0} width={8} height={h} fill={b.color} />
          <text x={dstX + 14} y={d0 + h / 2} className="fill-foreground text-[13px]">
            {b.label}{" "}
            <tspan className="font-semibold">{counts[b.key]}</tspan>
          </text>
        </g>
      ))}
    </svg>
  );
}

const DEMO_COURSES = [
  {
    title: "How to run an effective coffee chat",
    tag: "Networking",
    notes: "Prepare 3 questions, keep it to 20 minutes, ask who else to talk to, follow up within 48h.",
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
  const [showGraph, setShowGraph] = useState(false);
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of apps) c[bucketOf(a.status)] = (c[bucketOf(a.status)] ?? 0) + 1;
    return c;
  }, [apps]);
  const isSample = apps.length === 0;

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
            Built from applications you track (incl. Apply clicks) and, once connected, Gmail updates.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={() => setShowGraph((v) => !v)}>
            {showGraph ? "Hide graph" : "Generate graph"}
          </button>
          <button className="btn" disabled={busy} onClick={runAdvice}>
            {busy ? "Thinking…" : "AI feedback"}
          </button>
        </div>
      </div>

      {showGraph && (
        <div className="mt-4">
          {isSample && (
            <p className="mb-2 inline-block rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Sample data — track applications to see your own flow
            </p>
          )}
          <FlowGraph counts={isSample ? SAMPLE : counts} />
          <p className="mt-2 text-xs text-muted-foreground">
            Gmail scan: {suggestionsCount > 0 ? `${suggestionsCount} pending update(s) not yet counted` : "not connected yet"} ·
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
                    <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
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
            You have {apps.length} tracked application(s) and {chats.length} coffee chat(s). Once AI is
            connected, feedback here will be based on those numbers and the comments you leave on each chat.
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
