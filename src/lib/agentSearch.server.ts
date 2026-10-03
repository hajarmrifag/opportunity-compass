// Server-only research agent. Model calls go to the Lovable AI Gateway (Responses, streamed);
// web search/page reading go to the already-linked managed Firecrawl connection.
// Only the search form fields are ever sent; never Passport, CV, name, email or notes.
import {
  AGENT_DEADLINE_MS,
  AGENT_MAX_PAGES,
  AGENT_MAX_QUERIES,
  AGENT_MODEL,
  AGENT_MODEL_TIMEOUT_MS,
  PLAN_SCHEMA,
  PLANNER_SYSTEM,
  REVIEW_SCHEMA,
  REVIEWER_SYSTEM,
  isPublicHttpsUrl,
  pagesPerQuery,
  parsePlan,
  parseReview,
  plannerUserMessage,
  reviewerUserMessage,
  type AgentSearchError,
  type AgentSearchResponse,
  type AgentStage,
} from "./agentSearch";
import {
  applyFilters,
  cacheKey,
  dedupe,
  EXTRACTION_PROMPT,
  EXTRACTION_SCHEMA,
  mapHit,
  type LiveSearchInput,
  type RawSearchHit,
} from "./liveSearchMapping";
import type { Opportunity } from "@/domain/types";
import { isAbortError, reserveSearchSlot } from "./liveSearch.server";

const FIRECRAWL = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: AgentSearchResponse }>();

type Result = AgentSearchResponse | { ok: false; error: AgentSearchError };
export interface AgentDeps {
  fetch?: typeof fetch;
  deadlineMs?: number;
  modelTimeoutMs?: number;
  reserveSlot?: () => boolean;
  useCache?: boolean;
  /** Override the planner/reviewer model (Recommended page uses its own, with fallback). */
  model?: string;
}

class StepError extends Error {
  constructor(
    public kind: "model" | "search" | "rate" | "cancelled" | "timeout",
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export function _clearAgentCache() {
  cache.clear();
}

/** Streams a Responses call and returns the parsed JSON object from the final text. */
async function callModel(
  f: typeof fetch,
  apiKey: string,
  system: string,
  user: string,
  schemaName: string,
  schema: object,
  signal: AbortSignal,
  run: { id?: string },
  model: string = AGENT_MODEL,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Lovable-API-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "X-Lovable-AIG-SDK": "fetch",
  };
  if (run.id) headers["X-Lovable-AIG-Run-ID"] = run.id;
  const res = await f(AI_GATEWAY, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
  });
  const rid = res.headers.get("X-Lovable-AIG-Run-ID");
  if (!run.id && rid) run.id = rid;
  if (!res.ok || !res.body) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`AI gateway ${schemaName} failed [${res.status}]: ${body}`);
    const msg =
      res.status === 402
        ? "The workspace is out of AI credits. A workspace owner can add credits in Settings → Plans & credits."
        : res.status === 429
          ? "The AI service is busy. Please try again shortly."
          : res.status === 403
            ? "AI access was refused for this workspace."
            : `The AI service returned an error (${res.status}).`;
    throw new StepError("model", msg, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let refused = false;
  let failed = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let ev: { type?: string; delta?: string };
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string")
          text += ev.delta;
        else if (ev.type === "response.refusal.delta") refused = true;
        else if (ev.type === "response.failed" || ev.type === "error") failed = true;
      }
    }
  }
  if (refused) throw new StepError("model", "The AI model declined this request.");
  if (failed) throw new StepError("model", "The AI model failed to complete this step.");
  try {
    return JSON.parse(text);
  } catch {
    throw new StepError("model", "The AI model returned malformed output.");
  }
}

async function searchPages(
  f: typeof fetch,
  keys: { fc: string; lov: string },
  query: string,
  limit: number,
  input: LiveSearchInput,
  signal: AbortSignal,
  reserveSlot: () => boolean,
): Promise<RawSearchHit[]> {
  if (!reserveSlot())
    throw new StepError(
      "rate",
      "Too many searches in a minute. Please wait a moment and try again.",
    );
  const res = await f(`${FIRECRAWL}/search`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.lov}`,
      "X-Connection-Api-Key": keys.fc,
    },
    body: JSON.stringify({
      query,
      limit,
      ...(input.location && !input.remoteOnly ? { location: input.location } : {}),
      scrapeOptions: {
        onlyMainContent: true,
        formats: [{ type: "json", prompt: EXTRACTION_PROMPT, schema: EXTRACTION_SCHEMA }],
      },
    }),
  });
  if (!res.ok) {
    console.error(
      `Agent Firecrawl search failed [${res.status}]: ${(await res.text().catch(() => "")).slice(0, 300)}`,
    );
    throw new StepError(
      "search",
      res.status === 402
        ? "The search service has run out of credits."
        : res.status === 429
          ? "The search service is busy. Please try again shortly."
          : `Search service error (${res.status}).`,
      res.status,
    );
  }
  const payload = (await res.json()) as { data?: RawSearchHit[] | { web?: RawSearchHit[] } };
  const raw = Array.isArray(payload.data) ? payload.data : (payload.data?.web ?? []);
  // Bound pages regardless of what the provider returns; public https sources only.
  return raw.slice(0, limit).filter((h) => h && isPublicHttpsUrl(h.url));
}

function toCandidates(raw: RawSearchHit[], at: string): Opportunity[] {
  return raw
    .map((h) => mapHit(h, at))
    .filter((o): o is Opportunity => !!o)
    .map((o) => (o.applyUrl && !isPublicHttpsUrl(o.applyUrl) ? { ...o, applyUrl: null } : o));
}

export async function runAgentSearch(
  input: LiveSearchInput,
  signal?: AbortSignal,
  deps: AgentDeps = {},
): Promise<Result> {
  const fc = process.env["FIRECRAWL_API_KEY"];
  const lov = process.env["LOVABLE_API_KEY"];
  if (!fc || !lov)
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: "The research agent needs the linked web search connector and built-in AI.",
      },
    };
  const useCache = deps.useCache ?? true;
  const key = cacheKey(input);
  const hit = useCache ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, cached: true };

  const f = deps.fetch ?? fetch;
  const reserveSlot = deps.reserveSlot ?? reserveSearchSlot;
  const modelTimeout = deps.modelTimeoutMs ?? AGENT_MODEL_TIMEOUT_MS;
  const model = deps.model ?? AGENT_MODEL;
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, deps.deadlineMs ?? AGENT_DEADLINE_MS);
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const stages: AgentStage[] = [];
  const queries: string[] = [];
  const run: { id?: string } = {};
  let pagesRead = 0;
  let pagesRequested = 0;
  const keys = { fc, lov };

  const withModelTimeout = async <T>(fn: (s: AbortSignal) => Promise<T>) => {
    const local = new AbortController();
    const t = setTimeout(() => local.abort(), modelTimeout);
    const fwd = () => local.abort();
    ac.signal.addEventListener("abort", fwd, { once: true });
    try {
      return await fn(local.signal);
    } catch (e) {
      if (!ac.signal.aborted && local.signal.aborted)
        throw new StepError("model", "The AI model took too long to respond.");
      throw e;
    } finally {
      clearTimeout(t);
      ac.signal.removeEventListener("abort", fwd);
    }
  };

  const review = async (cands: Opportunity[]) =>
    withModelTimeout(async (s) => {
      const raw = await callModel(
        f,
        lov,
        REVIEWER_SYSTEM,
        reviewerUserMessage(input, cands),
        "evidence_review",
        REVIEW_SCHEMA,
        s,
        run,
        model,
      );
      const out = parseReview(
        raw,
        cands.map((c) => c.id),
      );
      if (!out)
        throw new StepError("model", "The AI model returned output that failed validation.");
      return out;
    });

  try {
    // 1. Planner (model)
    const plan = await withModelTimeout(async (s) => {
      const raw = await callModel(
        f,
        lov,
        PLANNER_SYSTEM,
        plannerUserMessage(input),
        "search_plan",
        PLAN_SCHEMA,
        s,
        run,
        model,
      );
      const q = parsePlan(raw);
      if (!q)
        throw new StepError("model", "The AI model returned a search plan that failed validation.");
      return q;
    });
    queries.push(...plan);
    stages.push({
      key: "plan",
      label: "Planned searches",
      detail: `${plan.length} quer${plan.length === 1 ? "y" : "ies"} written`,
      by: "model",
      ok: true,
    });

    // 2. Research (search tool + rule extraction)
    const retrievedAt = new Date().toISOString();
    const per = pagesPerQuery(plan.length);
    let raw: RawSearchHit[] = [];
    for (const q of plan) {
      pagesRequested += per;
      const r = await searchPages(f, keys, q, per, input, ac.signal, reserveSlot);
      pagesRead += r.length;
      raw = raw.concat(r);
    }
    let candidates = applyFilters(dedupe(toCandidates(raw, retrievedAt)), input);
    stages.push({
      key: "research",
      label: "Searched and read pages",
      detail: `${pagesRead} page${pagesRead === 1 ? "" : "s"} read · ${candidates.length} single-listing candidate${candidates.length === 1 ? "" : "s"} after rule checks (aggregate pages, duplicates and filter misses removed)`,
      by: "search_tool",
      ok: true,
    });

    // 3. Evidence review (model; may request one refinement)
    let kept: Opportunity[] = candidates;
    let reviewed = true;
    let refined = false;
    let refineQuery: string | null = null;
    if (candidates.length) {
      try {
        const out = await review(candidates);
        kept = candidates.filter((c) => out.keep.has(c.id));
        refineQuery = out.refineQuery;
        stages.push({
          key: "review",
          label: "Reviewed evidence",
          detail: `${kept.length} kept · ${out.rejected} rejected`,
          by: "model",
          ok: true,
        });
      } catch (e) {
        if (ac.signal.aborted) throw e;
        reviewed = false;
        stages.push({
          key: "review",
          label: "Evidence review failed",
          detail:
            e instanceof Error
              ? `${e.message} Showing rule-checked results only.`
              : "Showing rule-checked results only.",
          by: "model",
          ok: false,
        });
      }
    }

    // 4. One bounded refinement when evidence is thin.
    const remainingPages = AGENT_MAX_PAGES - pagesRequested;
    const wantRefine =
      reviewed && kept.length < 3 && queries.length < AGENT_MAX_QUERIES && remainingPages > 0;
    if (wantRefine) {
      // With no candidates there is nothing to review; ask the reviewer for a query anyway.
      if (!candidates.length) {
        try {
          const out = await review([]);
          refineQuery = out.refineQuery;
        } catch (e) {
          if (ac.signal.aborted) throw e;
        }
      }
      if (refineQuery && !queries.some((q) => q.toLowerCase() === refineQuery!.toLowerCase())) {
        queries.push(refineQuery);
        refined = true;
        pagesRequested += remainingPages;
        const r = await searchPages(
          f,
          keys,
          refineQuery,
          remainingPages,
          input,
          ac.signal,
          reserveSlot,
        );
        pagesRead += r.length;
        const seen = new Set(candidates.map((c) => c.id));
        const fresh = applyFilters(
          dedupe([...candidates, ...toCandidates(r, new Date().toISOString())]),
          input,
        ).filter((c) => !seen.has(c.id));
        stages.push({
          key: "refine",
          label: "Refined search once",
          detail: `${r.length} more page${r.length === 1 ? "" : "s"} read · ${fresh.length} new candidate${fresh.length === 1 ? "" : "s"}`,
          by: "search_tool",
          ok: true,
        });
        candidates = [...candidates, ...fresh];
        if (fresh.length) {
          try {
            const out = await review(fresh);
            const add = fresh.filter((c) => out.keep.has(c.id));
            kept = [...kept, ...add];
            stages.push({
              key: "review_refined",
              label: "Reviewed new evidence",
              detail: `${add.length} kept · ${out.rejected} rejected`,
              by: "model",
              ok: true,
            });
          } catch (e) {
            if (ac.signal.aborted) throw e;
            reviewed = false;
            kept = [...kept, ...fresh];
            stages.push({
              key: "review_refined",
              label: "Review of new evidence failed",
              detail: "New results shown with rule checks only.",
              by: "model",
              ok: false,
            });
          }
        }
      }
    }

    const value: AgentSearchResponse = {
      ok: true,
      results: dedupe(kept),
      stages,
      queries,
      pagesRead,
      refined,
      reviewed,
      retrievedAt,
      cached: false,
      model,
    };
    if (useCache) {
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 50) cache.delete(cache.keys().next().value!);
    }
    return value;
  } catch (e) {
    if (ac.signal.aborted || isAbortError(e)) {
      return timedOut
        ? {
            ok: false,
            error: {
              code: "timeout",
              message: "The research agent reached its time limit. Try again or use basic search.",
            },
          }
        : { ok: false, error: { code: "cancelled", message: "Research cancelled." } };
    }
    if (e instanceof StepError) {
      if (e.kind === "rate")
        return { ok: false, error: { code: "rate_limited", message: e.message } };
      if (e.kind === "search")
        return {
          ok: false,
          error: {
            code: "provider_error",
            message: e.message,
            ...(e.status ? { status: e.status } : {}),
          },
        };
      return {
        ok: false,
        error: {
          code: "model_error",
          message: e.message,
          ...(e.status ? { status: e.status } : {}),
          stages,
        },
      };
    }
    console.error("Agent search failed", e);
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "The research agent could not complete. Please try again.",
      },
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
