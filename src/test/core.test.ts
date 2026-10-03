import { describe, expect, it } from "vitest";
import { parseCsv, toCsv, escapeCell, CsvError } from "@/lib/csv";
import { autoMap, validateRows, actionFor, exportCsv, templateCsv } from "@/lib/trackerCsv";
import { isValidIsoDate, safeHttpUrl, deadlineState } from "@/lib/validation";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { DEMO_OPPORTUNITIES, DEMO_PROFILE } from "@/data/fixtures";
import type { Application, Opportunity } from "@/domain/types";
import {
  localRepository,
  normalizeCompareIds,
  STORAGE_KEY,
  STORAGE_VERSION,
  toggleCompareIds,
} from "@/data/storage";
import { activeFilters, searchSummary } from "@/routes/search";
import {
  applyExtractedCandidates,
  canConfirmProfile,
  extractionConflicts,
} from "@/lib/profileExtraction";
import type { DocumentExtractionResult } from "@/domain/types";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [["a", 'he said "hi"', "x,y", "line1\nline2"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("handles CRLF and BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n1,"2"\r\n')).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("rejects unterminated quotes", () => {
    expect(() => parseCsv('a,"b')).toThrow(CsvError);
  });
  it("neutralizes formula injection", () => {
    for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)"])
      expect(escapeCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(escapeCell("normal")).toBe("normal");
  });
});

describe("validation", () => {
  it("dates", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("31/12/2026")).toBe(false);
  });
  it("urls", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("example.com")).toBeNull();
    expect(safeHttpUrl("https://example.org/x")).toBe("https://example.org/x");
  });
  it("counts calendar days, local-midnight based (3 Oct -> 20 Oct = 17)", () => {
    for (const hour of [0, 1, 14, 23]) {
      const now = new Date(2026, 9, 3, hour, 59);
      expect(deadlineState("2026-10-20", now).days).toBe(17);
      expect(deadlineState("2026-10-03", now)).toEqual({ state: "closing_soon", days: 0 });
      expect(deadlineState("2026-10-02", now).state).toBe("expired");
    }
    expect(deadlineState("2026-10-17", new Date(2026, 9, 3)).state).toBe("closing_soon");
    expect(deadlineState("2026-10-18", new Date(2026, 9, 3)).state).toBe("open");
    // across a DST change (Europe/US late Oct/early Nov) still whole days
    expect(deadlineState("2026-11-10", new Date(2026, 9, 20, 12)).days).toBe(21);
  });
  it("expiry is timing only", () => {
    const now = new Date(2026, 9, 3, 12);
    expect(deadlineState("2026-10-01", now).state).toBe("expired");
    expect(deadlineState("2026-10-10", now).state).toBe("closing_soon");
    expect(deadlineState("bad", now).state).toBe("invalid");
    expect(deadlineState(null, now).state).toBe("unknown");
  });
});

describe("demo eligibility", () => {
  const opp = DEMO_OPPORTUNITIES[0]!;
  it("unconfirmed profile => all unknown, never eligible", () => {
    const r = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: false }, opp);
    expect(r.overall).toBe("incomplete");
    expect(r.requirements.every((x) => x.status === "unknown")).toBe(true);
  });
  it("missing profile fields are unknown, not met", () => {
    const r = demoEligibilityAdapter.evaluate(
      { ...DEMO_PROFILE, confirmed: true, degreeLevel: null, skills: [] },
      opp,
    );
    expect(r.requirements.find((x) => x.requirement.kind === "degreeLevel")!.status).toBe(
      "unknown",
    );
    expect(r.overall).not.toBe("meets_listed_criteria");
  });
  it("'other' criteria stay unknown so overall never fully passes", () => {
    const r = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: true }, opp);
    expect(r.requirements.find((x) => x.requirement.kind === "other")!.status).toBe("unknown");
    expect(r.overall).toBe("incomplete");
  });
  it("edited profile recomputes", () => {
    const research = DEMO_OPPORTUNITIES.find((o) => o.id === "demo-coastal-research")!;
    const a = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: true }, research);
    const b = demoEligibilityAdapter.evaluate(
      { ...DEMO_PROFILE, confirmed: true, field: "Biology" },
      research,
    );
    expect(a.overall).toBe("not_eligible");
    expect(b.overall).toBe("meets_listed_criteria");
  });
  it("fixtures stay honest", () => {
    for (const o of DEMO_OPPORTUNITIES) {
      expect(o.isDemo && o.verification === "demo_unverified").toBe(true);
      expect(o.applyUrl ?? o.sourceUrl ?? o.lastVerified).toBeNull();
    }
  });
});

describe("tracker csv import", () => {
  const opps: Opportunity[] = DEMO_OPPORTUNITIES;
  const apps: Application[] = [
    {
      id: "a1",
      opportunityId: opps[0]!.id,
      status: "saved",
      notes: "",
      deadline: null,
      createdAt: "",
      updatedAt: "",
      history: [],
      tasks: [],
    },
  ];
  const csv = [
    "Title,Company,Status,Deadline,URL",
    "New Thing,Acme,preparing,2026-12-01,https://acme.test",
    "New Thing,Acme,saved,,",
    `${opps[0]!.title},${opps[0]!.organization},submitted,,`,
    `${opps[1]!.title},${opps[1]!.organization},,,`,
    ",NoTitle,weird,2026-02-31,javascript:x",
  ].join("\n");
  const [h, ...body] = parseCsv(csv);
  const m = autoMap(h!);
  const rows = validateRows(body, m, opps, apps);
  it("maps aliases", () => {
    expect(m.organization).toBe(1);
    expect(m.link).toBe(4);
  });
  it("plans actions & dedupes", () => {
    expect(rows.map((r) => actionFor(r, "skip"))).toEqual([
      "create",
      "skip",
      "skip",
      "track",
      "invalid",
    ]);
    expect(actionFor(rows[2]!, "update")).toBe("update");
    expect(rows[4]!.errors.length).toBeGreaterThanOrEqual(4);
  });
  it("export + template are parseable", () => {
    expect(parseCsv(exportCsv(apps, opps))[1]![0]).toBe(opps[0]!.title);
    expect(parseCsv(templateCsv()).length).toBe(2);
  });
});

describe("comparison persistence", () => {
  it("deduplicates identity and enforces the three-item limit", () => {
    expect(normalizeCompareIds(["a", "a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(toggleCompareIds(["a", "b", "c"], "d")).toEqual({
      ids: ["a", "b", "c"],
      ok: false,
    });
    expect(toggleCompareIds(["a", "b"], "a")).toEqual({ ids: ["b"], ok: true });
  });

  it("migrates v1 without deleting profile, applications or opportunities", () => {
    const legacyApplication = {
      id: "legacy-a1",
      opportunityId: DEMO_OPPORTUNITIES[0]!.id,
      status: "saved",
      notes: "Keep this note",
      deadline: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      history: [],
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        profile: DEMO_PROFILE,
        applications: [legacyApplication],
        customOpportunities: [DEMO_OPPORTUNITIES[0]],
      }),
    );
    const loaded = localRepository.load().state;
    expect(loaded.version).toBe(STORAGE_VERSION);
    expect(loaded.profile?.fullName).toBe(DEMO_PROFILE.fullName);
    expect(loaded.applications[0]?.tasks).toEqual([]);
    expect(loaded.customOpportunities).toHaveLength(1);
    expect(loaded.compareIds).toEqual([]);
  });
});

describe("guided search mapping", () => {
  const form = {
    query: "climate policy",
    category: "fellowship",
    location: "Brussels",
    remoteOnly: false,
    subject: "policy",
    education: "Master's",
    fundedOnly: true,
    deadlineAfter: "2026-11-01",
  };
  it("maps every active control into an editable summary", () => {
    expect(activeFilters(form)).toEqual([
      "Fellowship",
      "Brussels",
      "policy",
      "Master's",
      "Funding stated",
      "Deadline from 2026-11-01",
    ]);
    expect(searchSummary(form)).toContain("climate policy · Fellowship · Brussels");
  });
});

describe("profile document parsing", () => {
  const cv: DocumentExtractionResult = {
    ok: true,
    document: { name: "TEST-cv.txt", label: "cv" },
    candidates: [
      { field: "school", value: "Test University", sourceFile: "TEST-cv.txt", snippet: "Student at Test University" },
      { field: "gpaValue", value: "3.6", sourceFile: "TEST-cv.txt", snippet: "GPA 3.6" },
      { field: "skill", value: "Python", sourceFile: "TEST-cv.txt", snippet: "Skills: Python" },
    ],
    warnings: [],
    error: null,
  };
  const transcript: DocumentExtractionResult = {
    ok: true,
    document: { name: "TEST-transcript.txt", label: "transcript" },
    candidates: [
      { field: "gpaValue", value: "3.4", sourceFile: "TEST-transcript.txt", snippet: "Cumulative GPA: 3.4" },
      { field: "gpaScale", value: "4.0", sourceFile: "TEST-transcript.txt", snippet: "Scale: 4.0" },
    ],
    warnings: [],
    error: null,
  };

  it("keeps conflicting document values unresolved until the student chooses", () => {
    expect(extractionConflicts([cv, transcript]).map((item) => item.field)).toEqual(["gpaValue"]);
    const draft = applyExtractedCandidates(DEMO_PROFILE, [cv, transcript]);
    expect(draft.gpaValue).toBe("");
    expect(canConfirmProfile(draft, 1).ok).toBe(false);
    const resolved = applyExtractedCandidates(draft, [cv, transcript], { gpaValue: "3.4" });
    expect(resolved.gpaValue).toBe("3.4");
    expect(resolved.gpaScale).toBe("4.0");
  });

  it("requires a GPA scale but allows other unknown fields", () => {
    const noScale = { ...DEMO_PROFILE, gpaValue: "3.5", gpaScale: "" };
    expect(canConfirmProfile(noScale, 0).reason).toContain("GPA scale");
    expect(canConfirmProfile({ ...noScale, gpaScale: "4.0" }, 0).ok).toBe(true);
  });
});
