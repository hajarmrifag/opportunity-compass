import { describe, expect, it, beforeEach, vi } from "vitest";
import { applyFilters, buildQuery, dedupe, liveSearchInput, mapHit, normalizeUrl, idFromUrl } from "@/lib/liveSearchMapping";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { DEMO_PROFILE } from "@/data/fixtures";

const T = "2026-10-03T06:00:00.000Z";
const base = liveSearchInput.parse({ query: "climate fellowship" });
const hit = (over: Record<string, unknown> = {}, url = "https://org.example/fellowship?utm_source=x#top") => ({
  url, title: "Page title",
  json: { is_opportunity_listing: true, title: "Climate Fellowship", organization: "Org", category: "fellowship", mode: "remote",
    deadline: "2026-11-30", degree_levels: ["Bachelor's"], languages: ["English"], other_requirements: ["Right to work in UK"],
    tuition: "not_covered", living: "covered", travel: "maybe", apply_url: "https://evil.example/apply", ...over },
});

describe("live search mapping", () => {
  it("keeps source URL + retrievedAt, never invents facts", () => {
    const o = mapHit(hit(), T)!;
    expect(o.sourceUrl).toBe("https://org.example/fellowship?utm_source=x#top");
    expect(o.retrievedAt).toBe(T);
    expect(o.verification).toBe("web_retrieved");
    expect(o.isDemo).toBe(false);
    expect(o.applyUrl).toBeNull(); // off-site apply link dropped
    expect(o.funding.travel.status).toBe("unknown"); // invalid value -> unknown
    expect(o.funding.paymentTiming).toBeNull();
    expect(o.lastVerified).toBeNull();
  });
  it("keeps same-site apply links only", () => {
    expect(mapHit(hit({ apply_url: "https://apply.org.example/x" }), T)!.applyUrl).toBe("https://apply.org.example/x");
  });
  it("drops non-listings, unsafe URLs and invalid dates", () => {
    expect(mapHit(hit({ is_opportunity_listing: false }), T)).toBeNull();
    expect(mapHit(hit({}, "javascript:alert(1)"), T)).toBeNull();
    expect(mapHit({ url: "https://x.example", json: "garbage" }, T)).toBeNull();
    expect(mapHit(hit({ deadline: "2026-02-31" }), T)!.deadline).toBeNull();
  });
  it("unknown requirements never pass", () => {
    const o = mapHit(hit(), T)!;
    const r = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: true }, o);
    expect(r.requirements.find((x) => x.requirement.label.includes("Right to work"))!.status).toBe("unknown");
    expect(r.overall).not.toBe("meets_listed_criteria");
  });
  it("dedupes by normalized URL and title+org", () => {
    const a = mapHit(hit(), T)!;
    const b = mapHit(hit({}, "https://org.example/fellowship"), T)!;
    const c = mapHit(hit({}, "https://mirror.example/copy"), T)!;
    expect(normalizeUrl("https://org.example/fellowship?utm_source=x#top")).toBe("https://org.example/fellowship");
    expect(a.id).toBe(idFromUrl("https://org.example/fellowship"));
    expect(dedupe([a, b, c])).toHaveLength(1);
  });
  it("filters exclude unknowns", () => {
    const known = mapHit(hit(), T)!;
    const unknown = mapHit(hit({ category: null, mode: null, deadline: null, living: "unknown" }), "x")!;
    expect(applyFilters([known, unknown], { ...base, category: "fellowship" })).toEqual([known]);
    expect(applyFilters([known, unknown], { ...base, remoteOnly: true })).toEqual([known]);
    expect(applyFilters([known, unknown], { ...base, fundedOnly: true })).toEqual([known]);
    expect(applyFilters([known, unknown], { ...base, deadlineAfter: "2026-11-01" })).toEqual([known]);
    expect(applyFilters([known], { ...base, deadlineAfter: "2026-12-01" })).toEqual([]);
  });
  it("query contains only the search form fields (no Passport data)", () => {
    const q = buildQuery({ ...base, category: "masters", subject: "Ecology", remoteOnly: true, location: "Berlin" });
    expect(q).toContain("Master's programme");
    expect(q).toContain("remote");
    expect(q).not.toContain("Berlin");
    expect(q).not.toContain(DEMO_PROFILE.fullName);
    expect(Object.keys(liveSearchInput.shape).sort()).toEqual(["category", "deadlineAfter", "education", "fundedOnly", "location", "query", "remoteOnly", "subject"]);
  });
  it("bounds input", () => {
    expect(liveSearchInput.safeParse({ query: "x".repeat(201) }).success).toBe(false);
    expect(liveSearchInput.safeParse({ query: "a" }).success).toBe(false);
  });
});

describe("live search server", () => {
  beforeEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });
  it("returns not_configured without calling the network (no demo fallback)", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    const f = vi.spyOn(globalThis, "fetch");
    const { runLiveSearch } = await import("@/lib/liveSearch.server");
    const r = await runLiveSearch(base);
    expect(r).toMatchObject({ ok: false, error: { code: "not_configured" } });
    expect(f).not.toHaveBeenCalled();
  });
  it("maps provider data, caches, rate-limits and surfaces provider errors", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "lovc_test"); vi.stubEnv("LOVABLE_API_KEY", "k");
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { web: [hit(), hit({ is_opportunity_listing: false }, "https://news.example/x")] } })));
    const { runLiveSearch } = await import("@/lib/liveSearch.server");
    const r1 = await runLiveSearch(base);
    expect(r1).toMatchObject({ ok: true, cached: false, dropped: 1 });
    if (r1.ok) expect(r1.results[0]!.title).toBe("Climate Fellowship");
    const sent = JSON.parse(String(f.mock.calls[0]![1]!.body));
    expect(sent.limit).toBeLessThanOrEqual(8);
    expect((await runLiveSearch(base)) ).toMatchObject({ ok: true, cached: true });
    expect(f).toHaveBeenCalledTimes(1);
    f.mockResolvedValue(new Response("no credits", { status: 402 }));
    expect(await runLiveSearch({ ...base, query: "other one" })).toMatchObject({ ok: false, error: { code: "provider_error", status: 402 } });
    for (let i = 0; i < 6; i++) await runLiveSearch({ ...base, query: `q${i}x` });
    expect(await runLiveSearch({ ...base, query: "one more" })).toMatchObject({ ok: false, error: { code: "rate_limited" } });
  });
});
