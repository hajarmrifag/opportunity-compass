import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { liveSearch, liveSearchStatus } from "@/lib/liveSearch.functions";
import { agentSearch } from "@/lib/agentSearch.functions";
import type { AgentSearchResponse } from "@/lib/agentSearch";
import {
  liveSearchInput,
  categoryKnown,
  type LiveSearchInput,
  type LiveSearchResponse,
} from "@/lib/liveSearchMapping";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { CATEGORY_LABELS, DEGREE_LABELS, type Opportunity } from "@/domain/types";
import { useStore } from "@/lib/store";
import {
  CoverageChip,
  DeadlineText,
  EmptyState,
  PageHeader,
  ReqStatus,
} from "@/components/ui-bits";
import { deadlineState } from "@/lib/validation";
import { CompareButton } from "@/components/CompareButton";
import { RESEARCH_REPLAY } from "@/data/fixtures";
import { runResearchReplay } from "@/lib/researchReplay";
import { EvidenceTrail } from "@/components/research/EvidenceTrail";
import { TrailResults } from "@/components/research/TrailResults";
import { useResearchTrail } from "@/components/research/useResearchTrail";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string; demo?: boolean } => {
    const next: { q?: string; demo?: boolean } = {};
    if (typeof s["q"] === "string" && s["q"]) next.q = s["q"].slice(0, 200);
    if (s["demo"] === true || s["demo"] === 1 || s["demo"] === "1" || s["demo"] === "true") {
      next.demo = true;
    }
    return next;
  },
  head: () => ({
    meta: [
      { title: "Search · Sourced" },
      {
        name: "description",
        content:
          "Search the web for internships, fellowships, master's programmes and jobs, with original sources.",
      },
      { property: "og:title", content: "Search · Sourced" },
      {
        property: "og:description",
        content:
          "Search the web for internships, fellowships, master's programmes and jobs, with original sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSearchPage,
});

type Status = "idle" | "loading" | "done" | "error" | "cancelled";
type SearchMode = "basic" | "agent" | "replay";
const EMPTY: LiveSearchInput = {
  query: "",
  category: "all",
  location: "",
  remoteOnly: false,
  subject: "",
  education: "",
  fundedOnly: false,
  deadlineAfter: "",
};

function LiveSearchPage() {
  const { q, demo } = Route.useSearch();
  const search = useServerFn(liveSearch);
  const agent = useServerFn(agentSearch);
  const [mode, setMode] = useState<SearchMode>(demo ? "replay" : "basic");
  const [agentResp, setAgentResp] = useState<AgentSearchResponse | null>(null);
  const [agentFailed, setAgentFailed] = useState(false);
  const [usedMode, setUsedMode] = useState<SearchMode>(demo ? "replay" : "basic");
  const trail = useResearchTrail();
  const [replaySpeed, setReplaySpeed] = useState(1);
  const status$ = useServerFn(liveSearchStatus);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [form, setForm] = useState<LiveSearchInput>({
    ...EMPTY,
    query: demo ? RESEARCH_REPLAY.query : (q ?? ""),
  });
  const autoRan = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [resp, setResp] = useState<LiveSearchResponse | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastInput = useRef<LiveSearchInput | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    status$()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
    mounted.current = true;
    // Navigating away cancels the in-flight search; its result is ignored, never thrown.
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, [status$]);

  useEffect(() => {
    if (!demo) return;
    setMode("replay");
    setForm((current) => ({ ...current, query: RESEARCH_REPLAY.query }));
    setUsedMode("replay");
    // Delay so React Strict Mode's immediate unmount does not cancel the run.
    const timer = window.setTimeout(() => {
      trail.start((emit, signal) =>
        runResearchReplay(RESEARCH_REPLAY, emit, { speed: 1, signal }),
      );
    }, 60);
    return () => window.clearTimeout(timer);
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (demo || autoRan.current || !configured || !q) return;
    autoRan.current = true;
    void run({ ...EMPTY, query: q });
  }, [configured, q, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof LiveSearchInput>(k: K, v: LiveSearchInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const startReplay = () => {
    abortRef.current?.abort();
    setStatus("idle");
    setError("");
    setResp(null);
    setAgentResp(null);
    setAgentFailed(false);
    setUsedMode("replay");
    trail.start((emit, signal) =>
      runResearchReplay(RESEARCH_REPLAY, emit, { speed: replaySpeed, signal }),
    );
  };

  const busy = status === "loading" || trail.running;
  // Replay never touches the network, so it stays available without the connector.
  const runControls = (
    <>
      <button
        className="btn"
        type="submit"
        disabled={busy || (configured === false && mode !== "replay")}
      >
        {busy
          ? mode === "replay"
            ? "Replaying…"
            : "Searching…"
          : mode === "replay"
            ? "Play recorded run"
            : mode === "agent"
              ? "Start research"
              : "Search the web"}
      </button>
      {busy && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => (mode === "replay" ? trail.cancel() : abortRef.current?.abort())}
        >
          Cancel
        </button>
      )}
    </>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "replay") {
      startReplay();
      return;
    }
    trail.reset();
    void run(form, mode);
  };
  const run = async (input: LiveSearchInput, runMode: "basic" | "agent" = "basic") => {
    const parsed = liveSearchInput.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your search");
      setStatus("error");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    lastInput.current = parsed.data;
    setStatus("loading");
    setError("");
    setResp(null);
    setAgentResp(null);
    setAgentFailed(false);
    setUsedMode(runMode);
    const stale = () => !mounted.current || abortRef.current !== ac;
    try {
      if (runMode === "agent") {
        const a = await agent({ data: parsed.data, signal: ac.signal });
        if (stale()) return;
        if (!a.ok) {
          if (a.error.code === "cancelled") return setStatus("cancelled");
          setAgentFailed(a.error.code === "model_error" || a.error.code === "timeout");
          setError(a.error.message);
          setStatus("error");
          return;
        }
        setAgentResp(a);
        setResp({
          ok: true,
          results: a.results,
          dropped: Math.max(0, a.pagesRead - a.results.length),
          cached: a.cached,
          retrievedAt: a.retrievedAt,
          queryUsed: a.queries.join(" | "),
        });
        setStatus("done");
        return;
      }
      const r = await search({ data: parsed.data, signal: ac.signal });
      if (stale()) return;
      if (ac.signal.aborted) {
        setStatus("cancelled");
        return;
      }
      if (!r.ok) {
        if (r.error.code === "cancelled") {
          setStatus("cancelled");
          return;
        }
        setError(r.error.message);
        setStatus("error");
        return;
      }
      setResp(r);
      setStatus("done");
    } catch (err) {
      if (stale()) return;
      if (ac.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        setStatus("cancelled");
        return;
      }
      setError(err instanceof Error && err.message ? err.message : "Search failed.");
      setStatus("error");
    }
  };

  if (demo) {
    return (
      <div className="atlas-cinema">
        <div className="atlas-cinema-bar">
          <p>Recorded run. Invented organisations. Not a live search.</p>
          <div className="atlas-cinema-bar-actions">
            {trail.running && (
              <button type="button" className="btn btn-outline btn-sm" onClick={trail.cancel}>
                Stop
              </button>
            )}
            <Link to="/" className="btn btn-sm">
              Back home
            </Link>
          </div>
        </div>
        {trail.state.phase === "idle" ? (
          <div className="atlas-cinema-cue">
            <p className="atlas-kicker">Cueing</p>
            <h2>Watch this.</h2>
          </div>
        ) : (
          <EvidenceTrail cinema state={trail.state} onCancel={trail.cancel} />
        )}
        {usedMode === "replay" && (
          <TrailResults state={trail.state} opportunities={RESEARCH_REPLAY.opportunities} />
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        kicker="Live web"
        title="Search"
        sub="Search the public web, then review every result against its original source."
      />
      {configured === false && !demo && trail.state.phase === "idle" && (
        <div role="status" className="card mb-6 border-l-4 border-l-primary p-5 text-sm">
          <strong>Web search is not connected yet.</strong> A project admin needs to link the web
          search connector before searches can run. Until then, nothing is searched and no example
          results are shown.{" "}
          <Link to="/discover" className="underline">
            Browse
          </Link>{" "}
          keeps demo listings for testing.
        </div>
      )}

      <form
        onSubmit={submit}
        className="atlas-search-workbench mb-8 grid gap-5 border-y border-border py-6 md:grid-cols-4"
        noValidate
      >
        <div className="md:col-span-4">
          <label htmlFor="lq">What are you looking for?</label>
          <input
            id="lq"
            value={form.query}
            maxLength={200}
            placeholder="e.g. funded climate policy fellowship for recent graduates"
            onChange={(e) => set("query", e.target.value)}
          />
        </div>
        <fieldset className="atlas-agent-mode md:col-span-4">
          <legend className="sr-only">Search mode</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Search mode">
            {(
              [
                ["basic", "Basic search", "One web search, rule-checked"],
                ["agent", "Research agent", "AI plans, reads up to 8 pages, reviews evidence"],
                ["replay", "Replay a recorded run", "Watch the agent work · demo data, no live search"],
              ] as const
            ).map(([m, label, hint]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={`atlas-mode-option ${mode === m ? "is-active" : ""}`}
                onClick={() => {
                  setMode(m);
                  // Show the query the recording was made with, so the run reads honestly.
                  if (m === "replay" && !form.query.trim()) set("query", RESEARCH_REPLAY.query);
                }}
              >
                <strong>{label}</strong>
                <span>{hint}</span>
              </button>
            ))}
          </div>
          {mode === "agent" && (
            <p className="mt-2 text-xs text-muted-foreground">
              The agent sends only this form to the built-in AI and the web search service, and
              reads public source pages. It never sends your Passport, CV, name, email or notes.
              Each run uses workspace credits (up to 3 searches, 8 pages, 3 short AI steps).
            </p>
          )}
          {mode === "replay" && (
            <div className="atlas-replay-controls mt-2">
              <p className="text-xs text-muted-foreground">
                Plays a recorded research run step by step so you can see how evidence is
                gathered and judged. Nothing is searched and every organisation is invented.
              </p>
              <div className="flex items-center gap-2" role="group" aria-label="Replay speed">
                <span className="atlas-card-index">Speed</span>
                {[1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={replaySpeed === s}
                    className={`btn btn-sm ${replaySpeed === s ? "" : "btn-outline"}`}
                    onClick={() => setReplaySpeed(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
        <div className="md:col-span-4">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={showGuidance}
            onClick={() => setShowGuidance((value) => !value)}
          >
            {showGuidance ? "Hide filters" : "More filters"}
          </button>
        </div>
        {showGuidance && (
          <>
            <div>
              <label htmlFor="lc">Category</label>
              <select
                id="lc"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="all">Any</option>
                {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ll">Location</label>
              <input
                id="ll"
                value={form.location}
                maxLength={80}
                disabled={form.remoteOnly}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ls">Subject</label>
              <input
                id="ls"
                value={form.subject}
                maxLength={80}
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="le">Education level</label>
              <select
                id="le"
                value={form.education}
                onChange={(e) => set("education", e.target.value)}
              >
                <option value="">Any</option>
                {Object.values(DEGREE_LABELS).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ld">Deadline on or after</label>
              <input
                id="ld"
                type="date"
                value={form.deadlineAfter}
                onChange={(e) => set("deadlineAfter", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 self-end font-normal">
              <input
                type="checkbox"
                className="w-auto"
                checked={form.remoteOnly}
                onChange={(e) => set("remoteOnly", e.target.checked)}
              />{" "}
              Remote only
            </label>
            <label className="flex items-center gap-2 self-end font-normal">
              <input
                type="checkbox"
                className="w-auto"
                checked={form.fundedOnly}
                onChange={(e) => set("fundedOnly", e.target.checked)}
              />{" "}
              Tuition or living costs covered
            </label>
            <div className="flex items-end gap-2">{runControls}</div>
          </>
        )}
        <div className="atlas-search-summary md:col-span-4 p-4 text-sm">
          <span className="atlas-card-index">Query brief</span>
          <strong className="ml-3">{searchSummary(form)}</strong>
          {hasFilters(form) && (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Active filters">
              {activeFilters(form).map((filter) => (
                <span className="chip chip-teal" key={filter}>
                  {filter}
                </span>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-primary underline"
                onClick={() => setForm((current) => ({ ...EMPTY, query: current.query }))}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
        {!showGuidance && (
          <div className="flex items-end gap-2 md:col-span-4">{runControls}</div>
        )}
        <p className="text-xs text-muted-foreground md:col-span-4">
          Only the fields above are sent to the search service. Never your name, Passport, CV or
          notes. Filters on unknown facts exclude the result (e.g. "deadline on or after" drops
          listings with no stated deadline).
        </p>
      </form>

      {trail.state.phase !== "idle" && (
        <div className="atlas-trail-stage zone zone-ink">
          <EvidenceTrail state={trail.state} onCancel={trail.cancel} />
          {usedMode === "replay" && (
            <TrailResults state={trail.state} opportunities={RESEARCH_REPLAY.opportunities} />
          )}
        </div>
      )}

      <div aria-live="polite">
        {status === "loading" && (
          <div className="atlas-research-wait mb-6 border border-border p-5" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>
                {usedMode === "agent" ? "Research agent working" : "Reading source pages"}
              </strong>
              <span className="atlas-card-index">LIVE RESEARCH</span>
            </div>
            <div className="atlas-research-progress mt-4" aria-hidden="true">
              <span />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {usedMode === "agent"
                ? "Research agent working: planning, searching, reading pages and reviewing evidence. This can take up to two minutes; completed steps appear when it finishes."
                : "Searching and reading source pages… this can take up to a minute."}
            </p>
          </div>
        )}
        {status === "cancelled" && (
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            Search cancelled.
            {lastInput.current && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => lastInput.current && void run(lastInput.current, usedMode === "agent" ? "agent" : "basic")}
              >
                Search again
              </button>
            )}
          </p>
        )}
        {status === "error" && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <span>{error}</span>
            {lastInput.current && configured !== false && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => lastInput.current && void run(lastInput.current, usedMode === "agent" ? "agent" : "basic")}
              >
                Retry
              </button>
            )}
            {agentFailed && lastInput.current && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => lastInput.current && void run(lastInput.current, "basic")}
              >
                Use basic search instead
              </button>
            )}
          </div>
        )}
        {status === "done" && resp && (
          <>
            {agentResp && <AgentActivity a={agentResp} />}
            {usedMode === "basic" && lastInput.current && resp && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Basic search (no AI review)
              </p>
            )}
            <p className="mb-3 text-sm text-muted-foreground">
              {resp.results.length} listing{resp.results.length === 1 ? "" : "s"} · retrieved{" "}
              {new Date(resp.retrievedAt).toLocaleString()}
              {resp.cached ? " (cached)" : ""} · {resp.dropped} page{resp.dropped === 1 ? "" : "s"}{" "}
              skipped (not a single listing, duplicate or filtered out)
            </p>
            {resp.results.length === 0 ? (
              <EmptyState
                title="No matching listings found"
                body="Try broader words or fewer filters. We don't fill gaps with made-up results."
              />
            ) : (
              <ol className="atlas-result-list atlas-stagger space-y-5">
                {resp.results.map((o, index) => (
                  <LiveResult key={o.id} opp={o} index={index + 1} />
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </>
  );
}

function AgentActivity({ a }: { a: AgentSearchResponse }) {
  const by = { model: "AI model", search_tool: "Web search", rules: "Rules" } as const;
  return (
    <section
      className="atlas-agent-panel mb-6 border border-border p-5"
      aria-label="Research agent activity"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl">Research agent</h2>
        <span className="atlas-card-index">
          {a.pagesRead} pages read · {a.queries.length} quer{a.queries.length === 1 ? "y" : "ies"}
          {a.cached ? " · cached" : ""}
        </span>
      </div>
      <ol className="atlas-evidence-trail mt-3 space-y-2 text-sm">
        {a.stages.map((s, i) => (
          <li key={i} className="flex flex-wrap gap-x-3 gap-y-1">
            <span className={`chip ${s.ok ? "chip-met" : "chip-notmet"}`}>
              {s.ok ? "Done" : "Failed"}
            </span>
            <strong>{s.label}</strong>
            <span className="text-muted-foreground">{s.detail}</span>
            <span className="atlas-card-index">{by[s.by]}</span>
          </li>
        ))}
      </ol>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer">Queries used</summary>
        <ul className="mt-2 list-disc pl-5">
          {a.queries.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-xs text-muted-foreground">
        Facts come only from each source page; the AI model ({a.model}) planned queries and kept or
        rejected candidates but cannot add facts.{" "}
        {a.reviewed
          ? ""
          : "AI review did not complete for some results. Those passed rule checks only. "}
        Not an exhaustive search. Verify every detail on the official source.
      </p>
    </section>
  );
}

function LiveResult({ opp, index }: { opp: Opportunity; index: number }) {
  const { profile, getApplication, getOpportunity, addManualOpportunity, saveOpportunity } =
    useStore();
  const [open, setOpen] = useState(false);
  const saved = !!getApplication(opp.id);
  const elig = demoEligibilityAdapter.evaluate(profile, opp);
  const t = deadlineState(opp.deadline).state;
  const timing =
    t === "expired" ? "Closed" : t === "unknown" || t === "invalid" ? "Status unknown" : "Open";
  const save = () => {
    if (!getOpportunity(opp.id)) addManualOpportunity(opp);
    saveOpportunity(opp.id);
  };
  return (
    <li
      className={`atlas-live-result atlas-category-${opp.category} border border-border p-5 md:p-7`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="atlas-result-number">{String(index).padStart(2, "0")}</span>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="chip chip-teal">
            {categoryKnown(opp) ? CATEGORY_LABELS[opp.category] : "Category unknown"}
          </span>
          <span className="chip chip-unknown">From live web · unverified</span>
          <span
            className={`chip ${timing === "Open" ? "chip-met" : timing === "Closed" ? "chip-notmet" : "chip-muted"}`}
          >
            {timing}
          </span>
        </div>
      </div>
      <h3 className="max-w-4xl text-2xl leading-tight md:text-4xl">{opp.title}</h3>
      <p className="text-sm text-muted-foreground">
        {opp.organization} · {opp.location} · {opp.mode.replace("_", " ")}
      </p>
      <p className="mt-4 max-w-4xl text-sm leading-relaxed">{opp.summary}</p>
      <p className="mt-2 text-sm">
        <DeadlineText iso={opp.deadline} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Source:{" "}
        {opp.sourceUrl ? (
          <a className="underline" href={opp.sourceUrl} target="_blank" rel="noopener noreferrer">
            {new URL(opp.sourceUrl).hostname}
          </a>
        ) : (
          "Not stated"
        )}{" "}
        · retrieved {opp.retrievedAt ? new Date(opp.retrievedAt).toLocaleString() : "unknown"}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button className="btn btn-sm" disabled={saved} onClick={save} aria-pressed={saved}>
          {saved ? "✓ Saved" : "Save to My Journey"}
        </button>
        <CompareButton opportunityId={opp.id} opportunity={opp} />
        <button
          className="btn btn-outline btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Eligibility & funding"}
        </button>
        <Link
          to="/opportunities/$id"
          params={{ id: opp.id }}
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (!getOpportunity(opp.id)) addManualOpportunity(opp);
          }}
        >
          View brief
        </Link>
      </div>
      {open && (
        <div className="atlas-disclosure mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold">Requirements found on page</h4>
            <p className="text-xs text-muted-foreground">
              Checked by the simple rule-based matcher (not AI) ·{" "}
              {profile?.confirmed ? "vs your confirmed Passport" : "confirm your Passport to check"}
            </p>
            {elig.requirements.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No requirements stated on the page. Eligibility unknown.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {elig.requirements.map((r) => (
                  <li
                    key={r.requirement.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span>{r.requirement.label}</span>
                    <ReqStatus s={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-semibold">Funding stated on page</h4>
            <dl className="mt-2 divide-y divide-border text-sm">
              {(["tuition", "living", "travel"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between py-2">
                  <dt>
                    {k === "living" ? "Living costs" : k === "tuition" ? "Tuition" : "Travel"}
                  </dt>
                  <dd>
                    <CoverageChip s={opp.funding[k].status} />
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <dt>Payment timing</dt>
                <dd>{opp.funding.paymentTiming ?? <CoverageChip s="unknown" />}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </li>
  );
}

function hasFilters(form: LiveSearchInput) {
  return (
    form.category !== "all" ||
    !!form.location ||
    form.remoteOnly ||
    !!form.subject ||
    !!form.education ||
    form.fundedOnly ||
    !!form.deadlineAfter
  );
}

export function activeFilters(form: LiveSearchInput) {
  return [
    form.category !== "all"
      ? (CATEGORY_LABELS[form.category as keyof typeof CATEGORY_LABELS] ?? form.category)
      : "",
    form.remoteOnly ? "Remote only" : form.location,
    form.subject,
    form.education,
    form.fundedOnly ? "Funding stated" : "",
    form.deadlineAfter ? `Deadline from ${form.deadlineAfter}` : "",
  ].filter(Boolean);
}

export function searchSummary(form: LiveSearchInput) {
  const filters = activeFilters(form);
  return `${form.query.trim() || "No search terms yet"}${filters.length ? ` · ${filters.join(" · ")}` : ""}`;
}
