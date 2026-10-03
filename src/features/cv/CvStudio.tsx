// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CvBuilderForm } from "./CvBuilderForm";
import { chatAboutCv, parseCv } from "./cvApi";
import { acceptStudentFacts, applyChange, buildFromAnswers, checkChange, cvFromPlainText, factsFromCv, flattenCv } from "./cvModel";
import { cvFileName, cvToDocxBlob, cvToPdfBlob, cvToTextBlob, downloadBlob, needsUnicodeFont } from "./exportCv";
import { CvReadError, readCvFile } from "./readCvFile";
import type { BuilderAnswers, ChatMessage, CheckedChange, CvDocument, Fact } from "./types";

interface OpportunityText {
  title: string;
  organiser?: string;
  description?: string;
  requirements?: string[];
}

const SAVED_KEY = "opportunityos.cv.master";
const area = "w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Pending = CheckedChange & { accepted: boolean };

/**
 * CV studio for one opportunity.
 * 1. Upload a CV (PDF, Word, text) or paste it — or build one from guided questions.
 * 2. Talk with the AI: it proposes changes; every change is checked against the student's facts before it can be accepted.
 * 3. Download as Word or PDF, then mark the CV as ready in the application plan.
 */
export function CvStudio({
  opportunity,
  profilePrefill,
  onReady,
}: {
  opportunity: OpportunityText;
  profilePrefill?: Partial<BuilderAnswers>;
  onReady: (cvText: string) => void;
}) {
  const [stage, setStage] = useState<"start" | "paste" | "build" | "studio">("start");
  const [doc, setDoc] = useState<CvDocument | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [mode, setMode] = useState<"tailor" | "build">("tailor");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [gaps, setGaps] = useState<Array<{ requirement: string; question?: string }>>([]);
  const [changed, setChanged] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [pasted, setPasted] = useState("");
  const [keep, setKeep] = useState(false);
  const [saved, setSaved] = useState<{ doc: CvDocument; facts: Fact[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const oppText = [opportunity.title, opportunity.organiser, opportunity.description, ...(opportunity.requirements ?? [])].filter(Boolean).join("\n");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (raw) {
        setSaved(JSON.parse(raw));
        setKeep(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!doc) return;
    try {
      if (keep) window.localStorage.setItem(SAVED_KEY, JSON.stringify({ doc, facts }));
      else window.localStorage.removeItem(SAVED_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [doc, facts, keep]);

  async function startWith(cv: CvDocument, cvFacts: Fact[], m: "tailor" | "build") {
    setDoc(cv);
    setFacts(cvFacts);
    setMode(m);
    setStage("studio");
    setMessages([]);
    const opener =
      m === "build"
        ? "I've just built my CV from my answers. Please tailor it for this opportunity and ask me about anything important that is missing."
        : "Please suggest how to tailor my CV for this opportunity.";
    await send(opener, cv, cvFacts, [], m);
  }

  async function fromText(text: string) {
    setBusy("Organising your CV…");
    setError(null);
    try {
      let cv: CvDocument | null = null;
      try {
        cv = await parseCv(text);
      } catch {
        cv = null; // fall back to an exact line-by-line copy
      }
      const finalCv = cv && cv.sections.length > 0 ? cv : cvFromPlainText(text);
      await startWith(finalCv, factsFromCv(finalCv, "cv"), "tailor");
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File) {
    setError(null);
    setBusy("Reading your file…");
    try {
      const text = await readCvFile(file);
      await fromText(text);
    } catch (e) {
      setError(e instanceof CvReadError ? e.message : "We could not read this file. Paste your CV text instead.");
      setBusy(null);
    }
  }

  async function send(text: string, cv = doc, currentFacts = facts, history = messages, m = mode) {
    if (!cv || !text.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const nextHistory = [...history, userMsg];
    setMessages(nextHistory);
    setDraftMessage("");
    setBusy("Thinking…");
    setError(null);
    try {
      const res = await chatAboutCv({ cv, facts: currentFacts, opportunity, messages: nextHistory, mode: m });
      const added = acceptStudentFacts(res.newFacts, userMsg.content, currentFacts);
      const allFacts = [...currentFacts, ...added];
      setFacts(allFacts);
      const checked = res.changes.map((c) => checkChange(cv, allFacts, oppText, c));
      const removed = checked.filter((c) => c.rejected).length;
      setPending(checked.filter((c) => !c.rejected).map((c) => ({ ...c, accepted: !c.needsConfirmation })));
      setGaps(res.gaps);
      const note = removed > 0 ? `\n\n(${removed} suggestion${removed === 1 ? " was" : "s were"} removed because ${removed === 1 ? "it" : "they"} added details you have not given.)` : "";
      setMessages([...nextHistory, { role: "assistant", content: (res.reply || "Here are my suggestions.") + note }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The CV assistant is unavailable right now.");
    } finally {
      setBusy(null);
    }
  }

  function applySelected() {
    if (!doc) return;
    let next = doc;
    const ids: string[] = [];
    for (const p of pending.filter((x) => x.accepted)) {
      next = applyChange(next, p.change);
      if (p.change.kind === "edit_bullet") ids.push(p.change.bulletId);
    }
    setDoc(next);
    setChanged(ids);
    setPending([]);
  }

  // ---------- Screens ----------

  if (stage === "start")
    return (
      <section className="space-y-3 rounded-lg border p-4" aria-label="CV for this application">
        <div>
          <h4 className="font-semibold">Your CV for {opportunity.title}</h4>
          <p className="text-sm text-muted-foreground">
            We suggest changes using only what is true about you. You decide what to keep, then download it as Word or PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {saved && (
            <Button onClick={() => startWith(saved.doc, saved.facts, "tailor")} disabled={!!busy}>
              Use my saved CV
            </Button>
          )}
          <Button variant={saved ? "outline" : "default"} onClick={() => fileRef.current?.click()} disabled={!!busy}>
            Upload my CV
          </Button>
          <Button variant="outline" onClick={() => setStage("paste")} disabled={!!busy}>
            Paste text
          </Button>
          <Button variant="outline" onClick={() => setStage("build")} disabled={!!busy}>
            I don't have a CV yet
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <p className="text-xs text-muted-foreground">PDF, Word (.docx) or text, up to 5 MB. Your file is read on your device; the text is sent to the AI only to make suggestions and is not stored.</p>
        {busy && <p className="text-sm">{busy}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    );

  if (stage === "paste")
    return (
      <section className="space-y-3 rounded-lg border p-4">
        <h4 className="font-semibold">Paste your CV</h4>
        <textarea className={`${area} min-h-56`} value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="CV text" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStage("start")}>
            Back
          </Button>
          <Button onClick={() => fromText(pasted)} disabled={pasted.trim().length < 40 || !!busy}>
            {busy ?? "Continue"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    );

  if (stage === "build")
    return (
      <CvBuilderForm
        prefill={profilePrefill}
        onCancel={() => setStage("start")}
        onDone={(answers) => {
          const cv = buildFromAnswers(answers);
          startWith(cv, factsFromCv(cv, "student"), "build");
        }}
      />
    );

  if (!doc) return null;
  const unicode = needsUnicodeFont(doc);

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label="CV studio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Your CV for {opportunity.title}</h4>
        <button className="text-xs text-muted-foreground underline" onClick={() => setStage("start")}>
          Start again
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CV preview */}
        <article className="rounded-md border bg-background p-4 text-sm" aria-label="CV preview">
          <p className="text-center text-lg font-semibold">{doc.name || "Your name"}</p>
          <p className="text-center text-xs text-muted-foreground">
            {[doc.contact.email, doc.contact.phone, doc.contact.location, ...(doc.contact.links ?? [])].filter(Boolean).join("  |  ")}
          </p>
          {doc.summary && <p className="mt-3">{doc.summary}</p>}
          {doc.sections.map((s) => (
            <div key={s.id} className="mt-4">
              <p className="border-b pb-1 font-semibold">{s.title}</p>
              {s.entries.map((e) => (
                <div key={e.id} className="mt-2">
                  {(e.heading || e.subheading || e.dates) && (
                    <p className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{[e.heading, e.subheading, e.location].filter(Boolean).join(", ")}</span>
                      {e.dates && <span className="text-muted-foreground">{e.dates}</span>}
                    </p>
                  )}
                  <ul className="list-disc pl-5">
                    {e.bullets.map((b) => (
                      <li key={b.id} className={changed.includes(b.id) ? "bg-primary/10" : ""}>
                        {b.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </article>

        {/* Conversation */}
        <div className="flex flex-col gap-3">
          <ol className="max-h-80 space-y-2 overflow-y-auto text-sm" aria-label="Conversation" aria-live="polite">
            {messages.map((m, i) => (
              <li key={i} className={`whitespace-pre-wrap rounded-md p-2 ${m.role === "user" ? "ml-6 bg-muted" : "mr-6 border"}`}>
                {m.content}
              </li>
            ))}
          </ol>

          {pending.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Suggested changes</p>
              <ul className="space-y-2">
                {pending.map((p, idx) => (
                  <li key={p.id} className="rounded border p-2 text-sm">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={p.accepted}
                        onChange={(e) => setPending(pending.map((x, j) => (j === idx ? { ...x, accepted: e.target.checked } : x)))}
                      />
                      <span className="min-w-0">
                        <ChangeText p={p} />
                        {p.change.reason && <span className="block text-xs text-muted-foreground">Why: {p.change.reason}</span>}
                        {p.issues.map((i) => (
                          <span key={i} className="mt-1 block text-xs">
                            <Badge variant="outline">Check</Badge> {i}
                          </span>
                        ))}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applySelected} disabled={!pending.some((p) => p.accepted)}>
                  Apply selected changes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPending([])}>
                  Discard all
                </Button>
              </div>
            </div>
          )}

          {gaps.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">The opportunity asks for things your CV does not show yet</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {gaps.map((g) => (
                  <li key={g.requirement}>{g.question ?? g.requirement}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">If you have this experience, tell us below and we will add it in your words.</p>
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draftMessage);
            }}
          >
            <textarea
              className={`${area} min-h-16`}
              placeholder="Ask for changes, or tell us more about your experience"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              aria-label="Message to the CV assistant"
            />
            <Button type="submit" disabled={!!busy || !draftMessage.trim()}>
              {busy ? "…" : "Send"}
            </Button>
          </form>
          {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      {/* Download and finish */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => downloadBlob(await cvToDocxBlob(doc), cvFileName(doc, "docx"))}>
            Download Word
          </Button>
          <Button variant="outline" onClick={() => downloadBlob(cvToPdfBlob(doc), cvFileName(doc, "pdf"))} disabled={unicode}>
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => downloadBlob(cvToTextBlob(doc), cvFileName(doc, "txt"))}>
            Download text
          </Button>
          <Button onClick={() => onReady(flattenCv(doc))}>Mark CV as ready</Button>
        </div>
        {unicode && (
          <p className="text-xs text-muted-foreground">
            Your CV contains characters the PDF option cannot draw. Download Word, then save it as PDF from Word.
          </p>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep my CV in this browser for my next application
        </label>
      </div>
    </section>
  );
}

function ChangeText({ p }: { p: Pending }) {
  const c = p.change;
  switch (c.kind) {
    case "edit_bullet":
      return (
        <span>
          <span className="block text-xs text-muted-foreground line-through">{p.before}</span>
          <span className="block">{c.newText}</span>
        </span>
      );
    case "add_bullet":
      return <span>Add: {c.newText}</span>;
    case "remove_bullet":
      return <span className="text-muted-foreground line-through">{p.before}</span>;
    case "move_section":
      return <span>Move "{p.before}" to position {c.toIndex + 1}</span>;
    case "edit_summary":
      return <span>Summary: {c.newText}</span>;
  }
}
