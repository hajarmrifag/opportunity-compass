// Server-only: runs one bounded research-agent search per category for the Recommended
// page. Reuses the existing agent (planner -> Firecrawl page reads -> rule extraction ->
// evidence review), its rate limiter and its honesty rules. Adds a longer per-category
// cache so a category only re-searches when its cache is stale and the student asks.
import { runAgentSearch, type AgentDeps } from "./agentSearch.server";
import type { LiveSearchInput } from "./liveSearchMapping";
import {
  categoryRequest,
  RECOMMENDED_FALLBACK_MODEL,
  RECOMMENDED_MODEL,
  type RecommendedInput,
  type RecommendedResult,
} from "./recommended";

const CACHE_TTL_MS = 6 * 60 * 60_000; // 6 hours per category+hints
const cache = new Map<string, { at: number; value: RecommendedResult }>();

export function _clearRecommendedCache() {
  cache.clear();
}

const cacheKeyFor = (input: RecommendedInput) =>
  `${input.category}:${JSON.stringify(input.hints)}`;

export async function runRecommended(
  input: RecommendedInput,
  signal?: AbortSignal,
  deps: AgentDeps = {},
): Promise<RecommendedResult> {
  const key = cacheKeyFor(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && hit.value.ok) {
    return { ...hit.value, search: { ...hit.value.search, cached: true } };
  }

  const h = input.hints;
  const searchInput: LiveSearchInput = {
    query: categoryRequest(input.category, h),
    category: input.category,
    location: "",
    // remoteOk is a preference, not a hard filter: most listings never state a mode,
    // so forcing it would hide nearly everything.
    remoteOnly: false,
    subject: h.field,
    education: h.degreeLevel,
    fundedOnly: false,
    deadlineAfter: "",
  };

  // Primary model first; on a model-side failure, one retry with the fallback model.
  let result = await runAgentSearch(searchInput, signal, { ...deps, model: RECOMMENDED_MODEL });
  if (!result.ok && result.error.code === "model_error" && !signal?.aborted) {
    result = await runAgentSearch(searchInput, signal, {
      ...deps,
      model: RECOMMENDED_FALLBACK_MODEL,
      useCache: false,
    });
  }
  if (!result.ok) return result;

  const value: RecommendedResult = { ok: true, category: input.category, search: result };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return value;
}
