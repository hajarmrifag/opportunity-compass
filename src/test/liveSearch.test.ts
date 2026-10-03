import { describe, expect, it, beforeEach, vi } from "vitest";
import { isAggregateUrl, applyFilters, buildQuery, dedupe, liveSearchInput, mapHit, normalizeUrl, idFromUrl } from "@/lib/liveSearchMapping";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { DEMO_PROFILE } from "@/data/fixtures";

const T = "2026-10-03T06:00:00.000Z";
const base = liveSearchInput.parse({ query: "climate fellowship" });
const hit = (over: Record<string, unknown> = {}, url = "https://org.example/fellowship?utm_source=x#top") => ({
  url, title: "Page title",
  json: { is_opportunity_listing: true, page_type: "single_opportunity_detail", listings_on_page: 1, title: "Climate Fellowship", organization: "Org", category: "fellowship", mode: "remote",
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

describe("aggregate / multi-listing pages (regression: HK test 3 Oct 2026)", () => {
  // Content the extractor returned for the two observed pages: a confident single-listing
  // answer stitched together from different entries. URL rules must reject it regardless.
  const stitched = { is_opportunity_listing: true, page_type: "single_opportunity_detail", listings_on_page: 1 };
  it("rejects intrack.hk category page even when extracted as one Hang Seng listing", () => {
    expect(isAggregateUrl("https://intrack.hk/internships/stem")).toBe(true);
    expect(mapHit({ url: "https://intrack.hk/internships/stem", title: "STEM Internships in Hong Kong",
      json: { ...stitched, title: "Software Engineer Intern", organization: "Hang Seng Bank", summary: "Summer Associate programme…", deadline: "2026-11-01" } }, T)).toBeNull();
  });
  it("rejects Indeed search-results page even when extracted as a Goldman Sachs listing", () => {
    expect(isAggregateUrl("https://hk.indeed.com/q-software-intern-jobs.html")).toBe(true);
    expect(mapHit({ url: "https://hk.indeed.com/q-software-intern-jobs.html", title: "Software Intern Jobs in Hong Kong",
      json: { ...stitched, title: "Summer Analyst", organization: "Goldman Sachs" } }, T)).toBeNull();
  });
  it("rejects other search/category patterns and model-flagged multi-listing pages", () => {
    for (const u of ["https://hk.indeed.com/jobs?q=software+intern&l=Hong+Kong", "https://www.linkedin.com/jobs/search/?keywords=intern",
      "https://www.ziprecruiter.com/Jobs/Graduate-Analyst-Program", "https://hk.jobsdb.com/software-intern-jobs", "https://careers.example.com/search?q=intern",
      "https://example.org/internships/"]) expect(isAggregateUrl(u), u).toBe(true);
    expect(mapHit(hit({ page_type: "multi_listing_or_search" }), T)).toBeNull();
    expect(mapHit(hit({ listings_on_page: 12 }), T)).toBeNull();
    expect(mapHit(hit({ page_type: undefined }), T)).toBeNull();
  });
  it("keeps specific detail pages, including on job boards", () => {
    for (const u of ["https://hk.indeed.com/viewjob?jk=abc123", "https://www.linkedin.com/jobs/view/4012345678",
      "https://www.citadel.com/careers/details/software-engineer-intern-asia/", "https://job-boards.greenhouse.io/pdtpartners/jobs/8077685",
      "https://cpo.noaa.gov/fellowships/"]) expect(isAggregateUrl(u), u).toBe(false);
  });
  it("preserves official master's programme pages", () => {
    for (const u of ["https://datascience.uchicago.edu/education/masters-programs/ms-in-applied-data-science/", "https://mds.ics.uci.edu/admissions/"]) {
      const o = mapHit(hit({ category: "masters", title: "MS in Applied Data Science", organization: "University" }, u), T);
      expect(o?.category, u).toBe("masters");
    }
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
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ data: { web: [hit(), hit({ is_opportunity_listing: false }, "https://news.example/x")] } })));
    const { runLiveSearch } = await import("@/lib/liveSearch.server");
    const r1 = await runLiveSearch(base);
    expect(r1).toMatchObject({ ok: true, cached: false, dropped: 1 });
    if (r1.ok) expect(r1.results[0]!.title).toBe("Climate Fellowship");
    const sent = JSON.parse(String(f.mock.calls[0]![1]!.body));
    expect(sent.limit).toBeLessThanOrEqual(8);
    expect((await runLiveSearch(base)) ).toMatchObject({ ok: true, cached: true });
    expect(f).toHaveBeenCalledTimes(1);
    f.mockImplementation(async () => new Response("no credits", { status: 402 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runLiveSearch({ ...base, query: "other one" })).toMatchObject({ ok: false, error: { code: "provider_error", status: 402 } });
    for (let i = 0; i < 6; i++) await runLiveSearch({ ...base, query: `q${i}x` });
    expect(await runLiveSearch({ ...base, query: "one more" })).toMatchObject({ ok: false, error: { code: "rate_limited" } });
  });
});
