// Deterministic replay driver for the Evidence Trail.
//
// This exists because the live web search connector is not configured. It emits exactly
// the same `ResearchEvent` stream a real agent run would, on a scripted timeline, so the
// trail UI can be built and demonstrated without inventing a backend or a fake network
// call. Swapping in the real agent means replacing this emitter, not the UI.
//
// It never claims to be live: `run_started` carries mode "replay" and the UI labels it.
import type { Opportunity } from "@/domain/types";
import type {
  PlannedQuery,
  ResearchEvent,
  TrailCandidate,
  TrailDecision,
  TrailEvidence,
  TrailSource,
} from "./researchTrail";

export type ReplayOutcome = "kept" | "rejected" | "fetch_failed" | "no_candidate";

export interface ReplaySourceSpec {
  source: TrailSource;
  outcome: ReplayOutcome;
  /** Why a fetch or extraction produced nothing. Required for the non-candidate outcomes. */
  failureReason?: string;
  evidence?: TrailEvidence[];
  candidate?: TrailCandidate;
  decision?: TrailDecision;
}

export interface ResearchReplayFixture {
  /** Prefilled into the search box so the run matches what the student sees. */
  query: string;
  queries: PlannedQuery[];
  sources: ReplaySourceSpec[];
  /** Proposed by the reviewer after the first pass, mirroring AGENT_MAX_REFINEMENTS = 1. */
  refineQuery: string | null;
  rankedCandidateIds: string[];
  /** Demo opportunities the kept candidates resolve to, keyed by candidate id. */
  opportunities: Record<string, Opportunity>;
}

/** Beat lengths in ms at speed 1. Tuned so a full run reads as deliberate, not sluggish. */
const BEAT = {
  bootPlan: 260,
  queryPlanned: 380,
  planToSearch: 320,
  searchStarted: 420,
  sourceFound: 170,
  beforeFetch: 260,
  fetching: 420,
  afterRead: 220,
  evidence: 360,
  candidate: 300,
  beforeReview: 520,
  decision: 560,
  refine: 700,
  beforeRank: 520,
  beforeComplete: 420,
} as const;

class Cancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "Cancelled";
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Cancelled());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Cancelled());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface ReplayOptions {
  /** >1 runs faster. The UI exposes 1x and 2x. */
  speed?: number;
  signal?: AbortSignal;
}

/**
 * Plays `fixture` as a research run, following the real agent loop:
 * plan -> search -> read+extract -> review -> (one refinement) -> review -> rank.
 *
 * Resolves when the run finishes, or when it is cancelled (after emitting `run_cancelled`).
 */
export async function runResearchReplay(
  fixture: ResearchReplayFixture,
  emit: (event: ResearchEvent) => void,
  options: ReplayOptions = {},
): Promise<void> {
  const speed = Math.max(0.25, options.speed ?? 1);
  const { signal } = options;
  const pause = (ms: number) => wait(ms / speed, signal);

  const initialQueries = fixture.queries.filter((q) => !q.refinement);
  const refinementQueries = fixture.queries.filter((q) => q.refinement);
  const sourcesFor = (queryId: string) =>
    fixture.sources.filter((s) => s.source.queryId === queryId);

  /** Search a query, then read and extract each of its pages in turn. */
  const sweep = async (query: PlannedQuery) => {
    emit({ type: "search_started", queryId: query.id });
    await pause(BEAT.searchStarted);

    const specs = sourcesFor(query.id);
    for (const spec of specs) {
      emit({ type: "source_found", source: spec.source });
      await pause(BEAT.sourceFound);
    }
    await pause(BEAT.beforeFetch);

    for (const spec of specs) {
      const id = spec.source.id;
      emit({ type: "source_fetching", sourceId: id });
      await pause(BEAT.fetching);

      if (spec.outcome === "fetch_failed") {
        emit({
          type: "source_failed",
          sourceId: id,
          reason: spec.failureReason ?? "Page could not be fetched",
        });
        await pause(BEAT.afterRead);
        continue;
      }

      emit({ type: "source_read", sourceId: id });
      await pause(BEAT.afterRead);
      emit({ type: "extraction_started", sourceId: id });
      await pause(BEAT.evidence);

      for (const evidence of spec.evidence ?? []) {
        emit({ type: "evidence_found", sourceId: id, evidence });
        await pause(BEAT.evidence);
      }

      if (spec.outcome === "no_candidate" || !spec.candidate) {
        emit({
          type: "extraction_empty",
          sourceId: id,
          reason: spec.failureReason ?? "No single opportunity found on the page",
        });
      } else {
        emit({ type: "candidate_formed", candidate: spec.candidate });
      }
      await pause(BEAT.candidate);
    }
  };

  /** Stamp a decision onto every candidate that does not have one yet. */
  const review = async (specs: ReplaySourceSpec[]) => {
    emit({ type: "review_started" });
    await pause(BEAT.beforeReview);
    for (const spec of specs) {
      if (!spec.candidate || !spec.decision) continue;
      emit({ type: "decision", candidateId: spec.candidate.id, decision: spec.decision });
      await pause(BEAT.decision);
    }
  };

  try {
    emit({ type: "run_started", query: fixture.query, mode: "replay" });
    await pause(BEAT.bootPlan);

    emit({ type: "plan_started" });
    await pause(BEAT.bootPlan);
    for (const query of initialQueries) {
      emit({ type: "query_planned", query });
      await pause(BEAT.queryPlanned);
    }
    emit({ type: "plan_completed" });
    await pause(BEAT.planToSearch);

    for (const query of initialQueries) {
      await sweep(query);
    }

    await review(initialQueries.flatMap((q) => sourcesFor(q.id)));

    if (fixture.refineQuery && refinementQueries.length > 0) {
      emit({ type: "refine_proposed", text: fixture.refineQuery });
      await pause(BEAT.refine);
      for (const query of refinementQueries) {
        emit({ type: "query_planned", query });
        await pause(BEAT.queryPlanned);
        await sweep(query);
      }
      await review(refinementQueries.flatMap((q) => sourcesFor(q.id)));
    }

    await pause(BEAT.beforeRank);
    emit({ type: "results_ranked", candidateIds: fixture.rankedCandidateIds });
    await pause(BEAT.beforeComplete);
    emit({ type: "run_completed" });
  } catch (error) {
    if (error instanceof Cancelled) {
      emit({ type: "run_cancelled" });
      return;
    }
    emit({
      type: "run_failed",
      message: error instanceof Error ? error.message : "Replay failed",
    });
  }
}

/** Rough wall-clock length of a run, used to size the progress affordance. */
export function estimateReplayDuration(fixture: ResearchReplayFixture, speed = 1): number {
  const initial = fixture.queries.filter((q) => !q.refinement);
  const withCandidates = fixture.sources.filter((s) => s.candidate && s.decision).length;
  const evidenceCount = fixture.sources.reduce((n, s) => n + (s.evidence?.length ?? 0), 0);
  const total =
    BEAT.bootPlan * 2 +
    BEAT.queryPlanned * fixture.queries.length +
    BEAT.planToSearch +
    BEAT.searchStarted * fixture.queries.length +
    BEAT.sourceFound * fixture.sources.length +
    BEAT.beforeFetch * (initial.length || 1) +
    (BEAT.fetching + BEAT.afterRead + BEAT.candidate) * fixture.sources.length +
    BEAT.evidence * (evidenceCount + fixture.sources.length) +
    BEAT.beforeReview * 2 +
    BEAT.decision * withCandidates +
    (fixture.refineQuery ? BEAT.refine : 0) +
    BEAT.beforeRank +
    BEAT.beforeComplete;
  return total / Math.max(0.25, speed);
}
