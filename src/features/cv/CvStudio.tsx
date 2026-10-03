// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CvBuilderForm } from "./CvBuilderForm";
import { analyzeOffer, chatAboutCv, parseCv, type OfferAnalysis } from "./cvApi";
import { acceptStudentFacts, applyChange, buildFromAnswers, checkChange, cvFromPlainText, factsFromCv, flattenCv, isLabelLine, sectionKind } from "./cvModel";
import { contactLines, cvFileName, cvToDocxBlob, cvToPdfBlob, cvToTextBlob, downloadBlob, needsUnicodeFont } from "./exportCv";
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
  officialUrl,
  profilePrefill,
  onReady,
}: {
  opportunity: OpportunityText;
  /** The opportunity's official page. The AI reads it to see what the employer asks for. */
  officialUrl?: string | null;
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

  // The AI reads the official page first, so the student never has to explain the job offer.
  const [offer, setOffer] = useState<OfferAnalysis | null>(null);
  const [offerState, setOfferState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const offerPromise = useRef<Promise<OfferAnalysis | null> | null>(null);

  useEffect(() => {
    if (!officialUrl) return;
    setOfferState("loading");
    offerPromise.current = analyzeOffer(officialUrl, opportunity.title)
      .then((o) => {
        setOffer(o);
        setOfferState("done");
        return o;
      })
      .catch(() => {
        setOfferState("failed");
        return null;
      });
  }, [officialUrl, opportunity.title]);

  const withOffer = (o: OfferAnalysis | null): OpportunityText => ({
    ...opportunity,
    description: o?.pageText || opportunity.description,
    requirements: [...(opportunity.requirements ?? []), ...(o?.lookingFor.map((x) => x.point) ?? [])],
  });
  const effective = withOffer(offer);
  const oppText = [effective.title, effective.organiser, effective.description, ...(effective.requirements ?? [])].filter(Boolean).join("\n");

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
      const o = offer ?? (offerPromise.current ? await offerPromise.current : null);
      const opp = withOffer(o);
      const checkText = [opp.title, opp.organiser, opp.description, ...(opp.requirements ?? [])].filter(Boolean).join("\n");
      const res = await chatAboutCv({ cv, facts: currentFacts, opportunity: opp, messages: nextHistory, mode: m });
      const added = acceptStudentFacts(res.newFacts, userMsg.content, currentFacts);
      const allFacts = [...currentFacts, ...added];
      setFacts(allFacts);
      const checked = res.changes.map((c) => checkChange(cv, allFacts, checkText, c));
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
        <OfferPanel offer={offer} state={offerState} title={opportunity.title} />
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

      <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
        <p className="mr-auto text-sm">
          <span className="font-medium">Your CV file.</span>{" "}
          <span className="text-muted-foreground">Download it and upload it to the application form.</span>
        </p>
        <Button size="sm" onClick={async () => downloadBlob(await cvToDocxBlob(doc), cvFileName(doc, "docx"))}>
          Download Word
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadBlob(cvToPdfBlob(doc), cvFileName(doc, "pdf"))} disabled={unicode}>
          Download PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(flattenCv(doc))}>
          Copy text
        </Button>
      </div>

      <OfferPanel offer={offer} state={offerState} title={opportunity.title} compact />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CV preview: same layout as the Word and PDF files */}
        <CvPage doc={doc} changed={changed} />

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

      {/* Finish */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
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

/** On-screen CV in the classic layout: centred name, UPPERCASE ruled headings, organisation and dates on one line, role in italics. */
function CvPage({ doc, changed }: { doc: CvDocument; changed: string[] }) {
  return (
    <article
      className="overflow-x-auto rounded-md border bg-white p-6 font-serif text-[13px] leading-snug text-black shadow-sm"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      aria-label="CV preview"
    >
      <p className="text-center text-xl">{doc.name || "Your name"}</p>
      {contactLines(doc).map((l) => (
        <p key={l} className="text-center text-[11px]">
          {l}
        </p>
      ))}
      {doc.summary && <p className="mt-2">{doc.summary}</p>}
      {doc.sections.map((s) => {
        const kind = s.kind ?? sectionKind(s.title);
        return (
          <section key={s.id} className="mt-3">
            <h5 className="border-b border-black font-bold uppercase">{s.title}</h5>
            {s.entries.map((e) =>
              isLabelLine(kind, e) ? (
                <p key={e.id} className={changed.includes(e.bullets[0].id) ? "bg-yellow-100" : ""}>
                  <span className="font-bold">{e.heading}:</span> {e.bullets[0].text}
                </p>
              ) : (
                <div key={e.id} className="mt-1">
                  {(e.heading || e.dates) && (
                    <p className="flex justify-between gap-4">
                      <span className="font-bold">{[e.heading, e.location].filter(Boolean).join(", ")}</span>
                      {e.dates && <span className="whitespace-nowrap">{e.dates}</span>}
                    </p>
                  )}
                  {e.subheading && <p className={kind === "education" ? "" : "pl-3 font-bold italic"}>{e.subheading}</p>}
                  <ul className="list-disc pl-6">
                    {e.bullets.map((b) => (
                      <li key={b.id} className={changed.includes(b.id) ? "bg-yellow-100" : ""}>
                        {b.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </section>
        );
      })}
    </article>
  );
}

/** What the employer asks for, read from the official page. Every point can show its quote. */
function OfferPanel({
  offer,
  state,
  title,
  compact,
}: {
  offer: OfferAnalysis | null;
  state: "idle" | "loading" | "done" | "failed";
  title: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  if (state === "idle") return null;
  if (state === "loading") return <p className="text-sm text-muted-foreground">Reading the official page for {title}…</p>;
  if (state === "failed" || !offer)
    return <p className="text-sm text-muted-foreground">We could not read the official page, so suggestions use the opportunity title only.</p>;

  const docs = offer.documents;
  return (
    <div className="rounded-md border p-3 text-sm" aria-label="What the employer asks for">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">What the official page asks for</p>
        {compact && (
          <button className="text-xs text-muted-foreground underline" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {offer.summary && <p>{offer.summary}</p>}
          {offer.lookingFor.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {offer.lookingFor.map((x) => (
                <li key={x.quote} title={`On the page: "${x.quote}"`}>
                  {x.point}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {docs.length > 0
              ? `Documents the page mentions: ${Array.from(new Set(docs.map((d) => d.kind.replace(/_/g, " ")))).join(", ")}.`
              : "The official page does not mention documents. Most applications still ask for a CV, so it is worth having one ready."}
          </p>
          {offer.keywords.length > 0 && (
            <p className="text-xs text-muted-foreground">Words from the page your CV can reflect, where true: {offer.keywords.join(", ")}</p>
          )}
          <a className="text-xs underline" href={offer.sourceUrl} target="_blank" rel="noreferrer">
            Official page
          </a>
        </div>
      )}
    </div>
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
