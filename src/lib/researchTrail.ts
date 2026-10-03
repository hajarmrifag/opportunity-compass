// Presentation contract for the Evidence Trail.
//
// The trail UI only ever consumes `ResearchEvent`s and renders `ResearchTrailState`.
// It has no idea where events come from, so the same components can be driven by:
//   - the deterministic replay driver (`researchReplay.ts`), used for demos, and
//   - a real research-agent stream, once the web search connector is configured.
//
// Nothing here performs IO or invents facts: every value shown in the UI must arrive
// on an event produced by whichever driver is attached.

export type TrailDecisionAuthor = "model" | "search_tool" | "rules";

export interface PlannedQuery {
  id: string;
  text: string;
  /** True when the planner proposed it after an unsatisfying first pass. */
  refinement: boolean;
}

export interface TrailSource {
  id: string;
  queryId: string;
  /** Display host, e.g. "careers.harborlight-analytics.test". */
  host: string;
  path: string;
  title: string;
}

/** A sentence lifted verbatim from the page, with the span that produced a fact. */
export interface TrailEvidence {
  id: string;
  field: string;
  value: string;
  sentence: string;
  /** Character span inside `sentence` that the extractor matched. */
  matchStart: number;
  matchEnd: number;
}

export interface TrailCandidate {
  id: string;
  sourceId: string;
  title: string;
  organization: string;
  category: string;
  location: string;
  deadline: string | null;
}

export type SourceStatus =
  | "found"
  | "fetching"
  | "read"
  | "extracting"
  | "extracted"
  | "failed"
  | "kept"
  | "rejected";

export interface TrailSourceState extends TrailSource {
  status: SourceStatus;
  evidence: TrailEvidence[];
  candidateId: string | null;
  /** Populated when the fetch or the extraction produced nothing usable. */
  failureReason: string | null;
}

export interface TrailDecision {
  keep: boolean;
  reason: string;
  by: TrailDecisionAuthor;
}

export interface TrailCandidateState extends TrailCandidate {
  decision: TrailDecision | null;
}

export type ResearchPhase =
  | "idle"
  | "planning"
  | "searching"
  | "reading"
  | "reviewing"
  | "ranking"
  | "done"
  | "failed"
  | "cancelled";

export type ResearchEvent =
  | { type: "run_started"; query: string; mode: "replay" | "live" }
  | { type: "plan_started" }
  | { type: "query_planned"; query: PlannedQuery }
  | { type: "plan_completed" }
  | { type: "search_started"; queryId: string }
  | { type: "source_found"; source: TrailSource }
  | { type: "source_fetching"; sourceId: string }
  | { type: "source_read"; sourceId: string }
  | { type: "source_failed"; sourceId: string; reason: string }
  | { type: "extraction_started"; sourceId: string }
  | { type: "evidence_found"; sourceId: string; evidence: TrailEvidence }
  | { type: "candidate_formed"; candidate: TrailCandidate }
  | { type: "extraction_empty"; sourceId: string; reason: string }
  | { type: "review_started" }
  | { type: "decision"; candidateId: string; decision: TrailDecision }
  | { type: "refine_proposed"; text: string }
  | { type: "results_ranked"; candidateIds: string[] }
  | { type: "run_completed" }
  | { type: "run_failed"; message: string }
  | { type: "run_cancelled" }
  /** UI-level, never emitted by a driver: clears the board back to idle. */
  | { type: "trail_reset" };

export interface ResearchTrailState {
  phase: ResearchPhase;
  mode: "replay" | "live" | null;
  query: string;
  queries: PlannedQuery[];
  /** Query currently being searched, for the "searching…" affordance. */
  activeQueryId: string | null;
  sources: TrailSourceState[];
  candidates: TrailCandidateState[];
  /** Final ordering; empty until `results_ranked`. */
  rankedIds: string[];
  refineQuery: string | null;
  error: string | null;
}

export const emptyTrail: ResearchTrailState = {
  phase: "idle",
  mode: null,
  query: "",
  queries: [],
  activeQueryId: null,
  sources: [],
  candidates: [],
  rankedIds: [],
  refineQuery: null,
  error: null,
};

function patchSource(
  state: ResearchTrailState,
  id: string,
  patch: Partial<TrailSourceState>,
): TrailSourceState[] {
  return state.sources.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function researchTrailReducer(
  state: ResearchTrailState,
  event: ResearchEvent,
): ResearchTrailState {
  switch (event.type) {
    case "run_started":
      return { ...emptyTrail, phase: "planning", mode: event.mode, query: event.query };
    case "plan_started":
      return { ...state, phase: "planning" };
    case "query_planned":
      return { ...state, queries: [...state.queries, event.query] };
    case "plan_completed":
      return { ...state, phase: "searching" };
    case "search_started":
      return { ...state, phase: "searching", activeQueryId: event.queryId };
    case "source_found":
      return {
        ...state,
        sources: [
          ...state.sources,
          {
            ...event.source,
            status: "found",
            evidence: [],
            candidateId: null,
            failureReason: null,
          },
        ],
      };
    case "source_fetching":
      return {
        ...state,
        phase: "reading",
        sources: patchSource(state, event.sourceId, { status: "fetching" }),
      };
    case "source_read":
      return { ...state, sources: patchSource(state, event.sourceId, { status: "read" }) };
    case "source_failed":
      return {
        ...state,
        sources: patchSource(state, event.sourceId, {
          status: "failed",
          failureReason: event.reason,
        }),
      };
    case "extraction_started":
      return {
        ...state,
        phase: "reading",
        sources: patchSource(state, event.sourceId, { status: "extracting" }),
      };
    case "evidence_found": {
      const source = state.sources.find((s) => s.id === event.sourceId);
      if (!source) return state;
      return {
        ...state,
        sources: patchSource(state, event.sourceId, {
          evidence: [...source.evidence, event.evidence],
        }),
      };
    }
    case "candidate_formed":
      return {
        ...state,
        sources: patchSource(state, event.candidate.sourceId, {
          status: "extracted",
          candidateId: event.candidate.id,
        }),
        candidates: [...state.candidates, { ...event.candidate, decision: null }],
      };
    case "extraction_empty":
      return {
        ...state,
        sources: patchSource(state, event.sourceId, {
          status: "failed",
          failureReason: event.reason,
        }),
      };
    case "review_started":
      return { ...state, phase: "reviewing" };
    case "decision": {
      const candidate = state.candidates.find((c) => c.id === event.candidateId);
      return {
        ...state,
        candidates: state.candidates.map((c) =>
          c.id === event.candidateId ? { ...c, decision: event.decision } : c,
        ),
        sources: candidate
          ? patchSource(state, candidate.sourceId, {
              status: event.decision.keep ? "kept" : "rejected",
            })
          : state.sources,
      };
    }
    case "refine_proposed":
      return { ...state, refineQuery: event.text };
    case "results_ranked":
      return { ...state, phase: "ranking", rankedIds: event.candidateIds };
    case "run_completed":
      return { ...state, phase: "done", activeQueryId: null };
    case "run_failed":
      return { ...state, phase: "failed", error: event.message, activeQueryId: null };
    case "run_cancelled":
      return { ...state, phase: "cancelled", activeQueryId: null };
    case "trail_reset":
      return emptyTrail;
    default:
      return state;
  }
}

export function isRunning(phase: ResearchPhase): boolean {
  return (
    phase === "planning" ||
    phase === "searching" ||
    phase === "reading" ||
    phase === "reviewing" ||
    phase === "ranking"
  );
}

/** Counts the trail renders in its header; derived so drivers never have to report them. */
export function trailTally(state: ResearchTrailState) {
  const read = state.sources.filter(
    (s) => s.status !== "found" && s.status !== "fetching" && s.status !== "failed",
  ).length;
  const kept = state.candidates.filter((c) => c.decision?.keep).length;
  const rejected = state.candidates.filter((c) => c.decision && !c.decision.keep).length;
  const failed = state.sources.filter((s) => s.status === "failed").length;
  return { read, kept, rejected, failed, queries: state.queries.length };
}

export const PHASE_LABELS: Record<ResearchPhase, string> = {
  idle: "Idle",
  planning: "Planning searches",
  searching: "Searching the web",
  reading: "Reading source pages",
  reviewing: "Reviewing evidence",
  ranking: "Ranking results",
  done: "Research complete",
  failed: "Research failed",
  cancelled: "Research cancelled",
};
