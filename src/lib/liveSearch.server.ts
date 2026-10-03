// Server-only: calls managed Firecrawl through the Lovable connector gateway.
// Requires FIRECRAWL_API_KEY (lovc_ connection key, set by linking the connector) + LOVABLE_API_KEY.
import {
  applyFilters,
  buildQuery,
  cacheKey,
  dedupe,
  EXTRACTION_PROMPT,
  EXTRACTION_SCHEMA,
  LIVE_MAX_RESULTS,
  mapHit,
  type LiveSearchError,
  type LiveSearchInput,
  type LiveSearchResponse,
  type RawSearchHit,
} from "./liveSearchMapping";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const CACHE_TTL_MS = 10 * 60_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
export const UPSTREAM_TIMEOUT_MS = 55_000;

// DOMException is not always an Error subclass (e.g. some test/runtime realms), so check the name.
export const isAbortError = (e: unknown) => {
  const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
  return name === "AbortError" || name === "TimeoutError";
};

// Best-effort, per-isolate. Serverless workers do not share memory, so this bounds bursts
// from one instance; it is not a global quota (documented in docs/LIVE_SEARCH.md).
const cache = new Map<string, { at: number; value: LiveSearchResponse }>();
const hits: number[] = [];

export function isConfigured(): boolean {
  return !!process.env["FIRECRAWL_API_KEY"] && !!process.env["LOVABLE_API_KEY"];
}

type Result = LiveSearchResponse | { ok: false; error: LiveSearchError };

/** Never throws for cancellation/timeout: returns a typed error so nothing becomes an unhandled rejection. */
export async function runLiveSearch(
  input: LiveSearchInput,
  signal?: AbortSignal,
  opts: { timeoutMs?: number } = {},
): Promise<Result> {
  const fc = process.env["FIRECRAWL_API_KEY"];
  const lov = process.env["LOVABLE_API_KEY"];
  if (!fc || !lov) {
    return {
      ok: false,
      error: {
        code: "not_configured",
        message:
          "Live search is not connected yet. A project admin must link the Firecrawl connector.",
      },
    };
  }
  const key = cacheKey(input);
  const c = cache.get(key);
  if (c && Date.now() - c.at < CACHE_TTL_MS) return { ...c.value, cached: true };

  const now = Date.now();
  while (hits.length && now - hits[0]! > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_PER_WINDOW) {
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message: "Too many searches in a minute. Please wait a moment and try again.",
      },
    };
  }
  hits.push(now);

  const queryUsed = buildQuery(input);
  // One controller aborts on either user cancellation or our upstream timeout.
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS);
  const onUserAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  else signal?.addEventListener("abort", onUserAbort, { once: true });
  const aborted = (): Result =>
    timedOut
      ? {
          ok: false,
          error: {
            code: "timeout",
            message: "The search service took too long to respond. Please try again.",
          },
        }
      : { ok: false, error: { code: "cancelled", message: "Search cancelled." } };
  let raw: RawSearchHit[];
  let retrievedAt: string;
  try {
    if (ac.signal.aborted) return aborted();
    const res = await fetch(`${GATEWAY}/search`, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lov}`,
        "X-Connection-Api-Key": fc,
      },
      body: JSON.stringify({
        query: queryUsed,
        limit: LIVE_MAX_RESULTS,
        ...(input.location && !input.remoteOnly ? { location: input.location } : {}),
        scrapeOptions: {
          onlyMainContent: true,
          formats: [{ type: "json", prompt: EXTRACTION_PROMPT, schema: EXTRACTION_SCHEMA }],
        },
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error(`Firecrawl search failed [${res.status}]: ${body}`);
      const msg =
        res.status === 402
          ? "The search service has run out of credits."
          : res.status === 429
            ? "The search service is busy. Please try again shortly."
            : res.status === 401 || res.status === 403
              ? "Search service access was refused. The connection may need to be re-linked."
              : `Search service error (${res.status}).`;
      return {
        ok: false,
        error: {
          code: res.status === 429 ? "rate_limited" : "provider_error",
          message: msg,
          status: res.status,
        },
      };
    }
    const payload = (await res.json()) as { data?: RawSearchHit[] | { web?: RawSearchHit[] } };
    raw = Array.isArray(payload.data) ? payload.data : (payload.data?.web ?? []);
    retrievedAt = new Date().toISOString();
  } catch (e) {
    if (ac.signal.aborted || isAbortError(e)) return aborted();
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Could not reach the search service. Please try again.",
      },
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onUserAbort);
  }
  const mapped = raw
    .map((h) => mapHit(h, retrievedAt))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const results = applyFilters(dedupe(mapped), input);
  const value: LiveSearchResponse = {
    ok: true,
    results,
    dropped: raw.length - results.length,
    cached: false,
    retrievedAt,
    queryUsed,
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return value;
}
