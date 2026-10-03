import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { liveSearch, liveSearchStatus } from "@/lib/liveSearch.functions";
import { liveSearchInput, categoryKnown, type LiveSearchInput, type LiveSearchResponse } from "@/lib/liveSearchMapping";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { CATEGORY_LABELS, DEGREE_LABELS, type Opportunity } from "@/domain/types";
import { useStore } from "@/lib/store";
import { CoverageChip, DeadlineText, EmptyState, PageHeader, ReqStatus } from "@/components/ui-bits";
import { deadlineState } from "@/lib/validation";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" && s["q"] ? { q: s["q"].slice(0, 200) } : {}),
  head: () => ({
    meta: [
      { title: "Live search — OpportunityOS" },
      { name: "description", content: "Search the web for internships, fellowships, master's programmes and jobs, with original sources." },
      { property: "og:title", content: "Live search — OpportunityOS" },
      { property: "og:description", content: "Search the web for internships, fellowships, master's programmes and jobs, with original sources." },
    ],
  }),
  component: LiveSearchPage,
});

type Status = "idle" | "loading" | "done" | "error" | "cancelled";
const EMPTY: LiveSearchInput = { query: "", category: "all", location: "", remoteOnly: false, subject: "", education: "", fundedOnly: false, deadlineAfter: "" };

function LiveSearchPage() {
  const search = useServerFn(liveSearch);
  const status$ = useServerFn(liveSearchStatus);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const { q } = Route.useSearch();
  const [form, setForm] = useState<LiveSearchInput>({ ...EMPTY, query: q ?? "" });
  const autoRan = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [resp, setResp] = useState<LiveSearchResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastInput = useRef<LiveSearchInput | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    status$().then((r) => setConfigured(r.configured)).catch(() => setConfigured(false));
    mounted.current = true;
    // Navigating away cancels the in-flight search; its result is ignored, never thrown.
    return () => { mounted.current = false; abortRef.current?.abort(); };
  }, [status$]);

  useEffect(() => {
    if (configured && q && !autoRan.current) { autoRan.current = true; void run({ ...EMPTY, query: q }); }
  }, [configured, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof LiveSearchInput>(k: K, v: LiveSearchInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => { e.preventDefault(); void run(form); };
  const run = async (input: LiveSearchInput) => {
    const parsed = liveSearchInput.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your search"); setStatus("error"); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    lastInput.current = parsed.data;
    setStatus("loading"); setError(""); setResp(null);
    const stale = () => !mounted.current || abortRef.current !== ac;
    try {
      const r = await search({ data: parsed.data, signal: ac.signal });
      if (stale()) return;
      if (ac.signal.aborted) { setStatus("cancelled"); return; }
      if (!r.ok) {
        if (r.error.code === "cancelled") { setStatus("cancelled"); return; }
        setError(r.error.message); setStatus("error"); return;
      }
      setResp(r); setStatus("done");
    } catch (err) {
      if (stale()) return;
      if (ac.signal.aborted || (err instanceof Error && err.name === "AbortError")) { setStatus("cancelled"); return; }
      setError(err instanceof Error && err.message ? err.message : "Search failed."); setStatus("error");
    }
  };

  return (
    <>
      <PageHeader title="Live search" sub="Searches the public web and extracts details from each original page. Results are not human-verified." />
      {configured === false && (
        <div role="status" className="card mb-6 border-l-4 border-l-primary p-5 text-sm">
          <strong>Live search is not connected yet.</strong> A project admin needs to link the web search connector before searches can run. Until then, nothing is searched and no example results are shown.
          {" "}<Link to="/discover" className="underline">Demo listings</Link> are kept separately for testing.
        </div>
      )}

      <form onSubmit={submit} className="card mb-6 grid gap-3 p-5 md:grid-cols-4" noValidate>
        <div className="md:col-span-4">
          <label htmlFor="lq">What are you looking for?</label>
          <input id="lq" value={form.query} maxLength={200} placeholder="e.g. funded climate policy fellowship for recent graduates" onChange={(e) => set("query", e.target.value)} />
        </div>
        <div><label htmlFor="lc">Category</label>
          <select id="lc" value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="all">Any</option>
            {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div><label htmlFor="ll">Location</label><input id="ll" value={form.location} maxLength={80} disabled={form.remoteOnly} onChange={(e) => set("location", e.target.value)} /></div>
        <div><label htmlFor="ls">Subject</label><input id="ls" value={form.subject} maxLength={80} onChange={(e) => set("subject", e.target.value)} /></div>
        <div><label htmlFor="le">Education level</label>
          <select id="le" value={form.education} onChange={(e) => set("education", e.target.value)}>
            <option value="">Any</option>
            {Object.values(DEGREE_LABELS).map((l) => <option key={l} value={l}>{l}</option>)}
          </select></div>
        <div><label htmlFor="ld">Deadline on or after</label><input id="ld" type="date" value={form.deadlineAfter} onChange={(e) => set("deadlineAfter", e.target.value)} /></div>
        <label className="flex items-center gap-2 self-end font-normal"><input type="checkbox" className="w-auto" checked={form.remoteOnly} onChange={(e) => set("remoteOnly", e.target.checked)} /> Remote only</label>
        <label className="flex items-center gap-2 self-end font-normal"><input type="checkbox" className="w-auto" checked={form.fundedOnly} onChange={(e) => set("fundedOnly", e.target.checked)} /> Tuition or living costs covered</label>
        <div className="flex items-end gap-2">
          <button className="btn" type="submit" disabled={status === "loading" || configured === false}>{status === "loading" ? "Searching…" : "Search the web"}</button>
          {status === "loading" && <button type="button" className="btn btn-outline" onClick={() => abortRef.current?.abort()}>Cancel</button>}
        </div>
        <p className="text-xs text-muted-foreground md:col-span-4">
          Only the fields above are sent to the search service — never your name, Passport, CV or notes. Filters on unknown facts exclude the result (e.g. "deadline on or after" drops listings with no stated deadline).
        </p>
      </form>

      <div aria-live="polite">
        {status === "loading" && <p className="text-sm text-muted-foreground" role="status">Searching and reading source pages… this can take up to a minute.</p>}
        {status === "cancelled" && (
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">Search cancelled.
            {lastInput.current && <button type="button" className="btn btn-outline btn-sm" onClick={() => lastInput.current && void run(lastInput.current)}>Search again</button>}</p>
        )}
        {status === "error" && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <span>{error}</span>
            {lastInput.current && configured !== false && <button type="button" className="btn btn-outline btn-sm" onClick={() => lastInput.current && void run(lastInput.current)}>Retry</button>}
          </div>
        )}
        {status === "done" && resp && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {resp.results.length} listing{resp.results.length === 1 ? "" : "s"} · retrieved {new Date(resp.retrievedAt).toLocaleString()}{resp.cached ? " (cached)" : ""} · {resp.dropped} page{resp.dropped === 1 ? "" : "s"} skipped (not a single listing, duplicate or filtered out)
            </p>
            {resp.results.length === 0
              ? <EmptyState title="No matching listings found" body="Try broader words or fewer filters. We don't fill gaps with made-up results." />
              : <ul className="space-y-4">{resp.results.map((o) => <LiveResult key={o.id} opp={o} />)}</ul>}
          </>
        )}
      </div>
    </>
  );
}

function LiveResult({ opp }: { opp: Opportunity }) {
  const { profile, getApplication, getOpportunity, addManualOpportunity, saveOpportunity } = useStore();
  const [open, setOpen] = useState(false);
  const saved = !!getApplication(opp.id);
  const elig = demoEligibilityAdapter.evaluate(profile, opp);
  const t = deadlineState(opp.deadline).state;
  const timing = t === "expired" ? "Closed" : t === "unknown" || t === "invalid" ? "Status unknown" : "Open";
  const save = () => {
    if (!getOpportunity(opp.id)) addManualOpportunity(opp);
    saveOpportunity(opp.id);
  };
  return (
    <li className="card p-5">
      <div className="mb-2 flex flex-wrap gap-2">
        <span className="chip chip-teal">{categoryKnown(opp) ? CATEGORY_LABELS[opp.category] : "Category unknown"}</span>
        <span className="chip chip-unknown">From live web · unverified</span>
        <span className={`chip ${timing === "Open" ? "chip-met" : timing === "Closed" ? "chip-notmet" : "chip-muted"}`}>{timing}</span>
      </div>
      <h3 className="text-lg">{opp.title}</h3>
      <p className="text-sm text-muted-foreground">{opp.organization} · {opp.location} · {opp.mode.replace("_", " ")}</p>
      <p className="mt-2 text-sm">{opp.summary}</p>
      <p className="mt-2 text-sm"><DeadlineText iso={opp.deadline} /></p>
      <p className="mt-1 text-xs text-muted-foreground">
        Source: <a className="underline" href={opp.sourceUrl!} target="_blank" rel="noopener noreferrer">{new URL(opp.sourceUrl!).hostname}</a> · retrieved {opp.retrievedAt ? new Date(opp.retrievedAt).toLocaleString() : "unknown"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={saved} onClick={save} aria-pressed={saved}>{saved ? "✓ Saved" : "Save to My Journey"}</button>
        <button className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Eligibility & funding"}</button>
        {saved && <Link to="/opportunities/$id" params={{ id: opp.id }} className="btn btn-ghost btn-sm">Open details</Link>}
      </div>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold">Requirements found on page</h4>
            <p className="text-xs text-muted-foreground">Checked by the simple rule-based matcher (not AI) · {profile?.confirmed ? "vs your confirmed Passport" : "confirm your Passport to check"}</p>
            {elig.requirements.length === 0
              ? <p className="mt-2 text-sm text-muted-foreground">No requirements stated on the page. Eligibility unknown.</p>
              : <ul className="mt-2 divide-y divide-border text-sm">{elig.requirements.map((r) => (
                  <li key={r.requirement.id} className="flex items-center justify-between gap-2 py-2"><span>{r.requirement.label}</span><ReqStatus s={r.status} /></li>))}</ul>}
          </div>
          <div>
            <h4 className="font-semibold">Funding stated on page</h4>
            <dl className="mt-2 divide-y divide-border text-sm">
              {(["tuition", "living", "travel"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between py-2"><dt>{k === "living" ? "Living costs" : k === "tuition" ? "Tuition" : "Travel"}</dt><dd><CoverageChip s={opp.funding[k].status} /></dd></div>))}
              <div className="flex items-center justify-between py-2"><dt>Payment timing</dt><dd>{opp.funding.paymentTiming ?? <CoverageChip s="unknown" />}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </li>
  );
}
