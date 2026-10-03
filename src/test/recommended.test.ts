import { beforeEach, describe, expect, it } from "vitest";
import {
  categoryRequest,
  hintsUsable,
  profileHints,
  recommendedInput,
  RECOMMENDED_CATEGORIES,
  RECOMMENDED_FALLBACK_MODEL,
  RECOMMENDED_MODEL,
} from "@/lib/recommended";
import { runRecommended, _clearRecommendedCache } from "@/lib/recommended.server";
import { _clearAgentCache } from "@/lib/agentSearch.server";
import { DEMO_PROFILE, EMPTY_PROFILE } from "@/data/fixtures";

const hints = profileHints(DEMO_PROFILE);
const input = recommendedInput.parse({ category: "internship", hints });

const page = (url: string) => ({
  url,
  title: "t",
  json: {
    is_opportunity_listing: true,
    page_type: "single_opportunity_detail",
    listings_on_page: 1,
    title: "Software Internship",
    organization: "Org",
    category: "internship",
    deadline: null,
    tuition: "unknown",
    living: "unknown",
    travel: "unknown",
  },
});

function sse(obj: unknown) {
  const text = JSON.stringify(obj);
  const body = `data: {"type":"response.created"}\n\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text.slice(0, 5) })}\n\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text.slice(5) })}\n\ndata: {"type":"response.completed"}\n\n`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function mockFetch(s: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: (body: any) => Response | Promise<Response>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search: (body: any) => Response | Promise<Response>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = { model: [] as any[], search: [] as any[] };
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (url.includes("ai.gateway")) {
      calls.model.push(body);
      return s.model(body);
    }
    calls.search.push(body);
    return s.search(body);
  }) as unknown as typeof fetch;
  return { f, calls };
}

const deps = (f: typeof fetch) => ({ fetch: f, useCache: false, reserveSlot: () => true });

beforeEach(() => {
  process.env["FIRECRAWL_API_KEY"] = "lovc_test";
  process.env["LOVABLE_API_KEY"] = "test";
  _clearAgentCache();
  _clearRecommendedCache();
});

describe("profile hints", () => {
  it("carries only non-identifying fields — never name, goals or documents", () => {
    const h = profileHints(DEMO_PROFILE);
    const json = JSON.stringify(h).toLowerCase();
    expect(json).not.toContain("maya");
    expect(json).not.toContain("@");
    expect(json).not.toContain(DEMO_PROFILE.goals.toLowerCase().slice(0, 12));
    expect(h.degreeLevel).toBeTruthy();
    expect(h.skills.length).toBeLessThanOrEqual(6);
    expect(h.languages.length).toBeLessThanOrEqual(4);
  });

  it("empty profile yields unusable hints", () => {
    expect(hintsUsable(profileHints(null))).toBe(false);
    expect(hintsUsable(profileHints(EMPTY_PROFILE))).toBe(false);
    expect(hintsUsable(hints)).toBe(true);
  });

  it("category request mentions the category and field, no personal data", () => {
    for (const c of RECOMMENDED_CATEGORIES) {
      const q = categoryRequest(c, hints);
      expect(q.length).toBeLessThanOrEqual(200);
      expect(q.toLowerCase()).not.toContain("maya");
    }
    expect(categoryRequest("masters", hints).toLowerCase()).toContain("master");
  });

  it("input schema rejects unknown categories and oversized hints", () => {
    expect(() => recommendedInput.parse({ category: "crypto", hints })).toThrow();
    expect(() =>
      recommendedInput.parse({ category: "job", hints: { ...hints, skills: Array(9).fill("x") } }),
    ).toThrow();
  });
});

describe("runRecommended", () => {
  it("returns listings from the primary model and tags the category", async () => {
    const { f, calls } = mockFetch({
      model: () => sse({ queries: ["software internship apply deadline"] }),
      search: () =>
        new Response(JSON.stringify({ data: [page("https://org.example/intern-1")] }), {
          status: 200,
        }),
    });
    // Planner then reviewer: reviewer keeps every candidate it is shown.
    let modelCalls = 0;
    const f2 = (async (url: string, init: RequestInit) => {
      if (url.includes("ai.gateway")) {
        modelCalls++;
        const body = JSON.parse(String(init.body));
        if (body.text.format.name === "search_plan")
          return sse({ queries: ["software internship apply deadline"] });
        const ids = [...body.input[1].content.matchAll(/"id":"(live-[a-z0-9]+)"/g)].map(
          (m) => m[1] as string,
        );
        return sse({
          decisions: ids.map((id) => ({ id, keep: true, reason: "ok" })),
          refine_query: null,
        });
      }
      return f(url, init);
    }) as unknown as typeof fetch;
    const result = await runRecommended(input, undefined, deps(f2));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.category).toBe("internship");
      expect(result.search.results.length).toBeGreaterThan(0);
      expect(result.search.model).toBe(RECOMMENDED_MODEL);
    }
    expect(calls.search.length).toBeGreaterThan(0);
  });

  it("falls back to the fallback model when the primary model fails", async () => {
    const seen: (string | undefined)[] = [];
    const { f } = mockFetch({
      model: (body) => {
        seen.push(body.model);
        if (body.model === RECOMMENDED_MODEL)
          return new Response("nope", { status: 500 });
        return sse({ queries: ["software internship"] });
      },
      search: () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    });
    const result = await runRecommended(input, undefined, deps(f));
    expect(seen[0]).toBe(RECOMMENDED_MODEL);
    expect(seen).toContain(RECOMMENDED_FALLBACK_MODEL);
    expect(result.ok).toBe(true);
  });

  it("serves the second identical request from cache without new provider calls", async () => {
    const { f, calls } = mockFetch({
      model: (body) => {
        if (body.text.format.name === "search_plan") return sse({ queries: ["software internship"] });
        const ids = [...body.input[1].content.matchAll(/"id":"(live-[a-z0-9]+)"/g)].map(
          (m) => m[1] as string,
        );
        return sse({
          decisions: ids.map((id) => ({ id, keep: true, reason: "ok" })),
          refine_query: null,
        });
      },
      search: () =>
        new Response(JSON.stringify({ data: [page("https://org.example/intern-2")] }), {
          status: 200,
        }),
    });
    const first = await runRecommended(input, undefined, deps(f));
    expect(first.ok).toBe(true);
    const searchCalls = calls.search.length;
    const second = await runRecommended(input, undefined, deps(f));
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.search.cached).toBe(true);
    expect(calls.search.length).toBe(searchCalls);
  });

  it("never throws on cancellation and reports it as cancelled", async () => {
    const ac = new AbortController();
    const { f } = mockFetch({
      model: () => {
        ac.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
      search: () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    });
    const result = await runRecommended(input, ac.signal, deps(f));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("cancelled");
  });
});
