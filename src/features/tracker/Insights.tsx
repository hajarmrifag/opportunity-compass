import { useState } from "react";
import type { AdviceResult, CoffeeChat, TrackerApplication } from "@/lib/tracker.functions";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

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
  onAdvice,
}: {
  apps: TrackerApplication[];
  chats: CoffeeChat[];
  onAdvice: () => Promise<AdviceResult>;
}) {
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="card mt-6 p-5" aria-labelledby="insights">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="insights" className="text-lg font-semibold">
            Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Personal feedback based on your tracked applications and coffee chats.
          </p>
        </div>
        <Button disabled={busy} onClick={runAdvice}>
          <Sparkles aria-hidden="true" />
          {busy ? "Thinking…" : "AI feedback"}
        </Button>
      </div>

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
            Preview. AI feedback isn't connected yet. Example output below.
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
