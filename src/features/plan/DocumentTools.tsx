import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkDraft } from "./cvGuard";
import { requestDocumentHelp } from "./usePlanData";

interface OpportunityText {
  title: string;
  organiser?: string;
  description?: string;
  requirements?: string[];
}

const areaClass =
  "w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PRIVACY = "Your CV is sent to the AI only when you press the button, and it is not stored.";

export function CoverLetterPanel({
  initialCv,
  opportunity,
  onReady,
}: {
  initialCv?: string;
  opportunity: OpportunityText;
  onReady: () => void;
}) {
  const [cv, setCv] = useState(initialCv ?? "");
  const [draft, setDraft] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oppText = [opportunity.title, opportunity.organiser, opportunity.description, ...(opportunity.requirements ?? [])]
    .filter(Boolean)
    .join("\n");
  const check = draft ? checkDraft(cv, oppText, draft) : null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestDocumentHelp("cover_letter", cv, opportunity);
      setDraft(res.draft ?? "");
      setMissing(res.missing ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="font-semibold">Draft a cover letter</h4>
        <p className="text-xs text-muted-foreground">The draft uses only facts from your CV. Edit it in your own voice. {PRIVACY}</p>
      </div>
      {!initialCv && (
        <textarea className={`${areaClass} min-h-32`} value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Paste your CV text" aria-label="Your CV text" />
      )}
      <Button onClick={run} disabled={busy || cv.trim().length < 20}>
        {busy ? "Writing a draft…" : draft ? "Write a new draft" : "Draft a cover letter"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {draft && (
        <>
          <textarea className={`${areaClass} min-h-56`} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Cover letter draft" />
          {check && !check.ok && (
            <div className="text-xs">
              {check.newNumbers.length > 0 && <p>Numbers not found in your CV: {check.newNumbers.join(", ")}. Remove them unless they are true.</p>}
              {check.newTerms.length > 0 && <p>Names not found in your CV or the opportunity: {check.newTerms.join(", ")}. Check them.</p>}
            </div>
          )}
          {missing.length > 0 && <p className="text-xs text-muted-foreground">Worth adding if true: {missing.join("; ")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(draft)}>
              Copy letter
            </Button>
            <Button onClick={onReady}>Mark cover letter as ready</Button>
          </div>
        </>
      )}
    </section>
  );
}
