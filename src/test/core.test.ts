import { describe, expect, it } from "vitest";
import { parseCsv, toCsv, escapeCell, CsvError } from "@/lib/csv";
import { autoMap, validateRows, actionFor, exportCsv, templateCsv } from "@/lib/trackerCsv";
import { isValidIsoDate, safeHttpUrl, deadlineState } from "@/lib/validation";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { DEMO_OPPORTUNITIES, DEMO_PROFILE } from "@/data/fixtures";
import type { Application, Opportunity } from "@/domain/types";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [["a", 'he said "hi"', "x,y", "line1\nline2"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("handles CRLF and BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n1,"2"\r\n')).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("rejects unterminated quotes", () => {
    expect(() => parseCsv('a,"b')).toThrow(CsvError);
  });
  it("neutralizes formula injection", () => {
    for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) expect(escapeCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
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
  it("expiry is timing only", () => {
    const now = new Date("2026-10-03T12:00:00");
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
    const r = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: true, degreeLevel: null, skills: [] }, opp);
    expect(r.requirements.find((x) => x.requirement.kind === "degreeLevel")!.status).toBe("unknown");
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
    const b = demoEligibilityAdapter.evaluate({ ...DEMO_PROFILE, confirmed: true, field: "Biology" }, research);
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
  const apps: Application[] = [{ id: "a1", opportunityId: opps[0]!.id, status: "saved", notes: "", deadline: null, createdAt: "", updatedAt: "", history: [] }];
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
  it("maps aliases", () => { expect(m.organization).toBe(1); expect(m.link).toBe(4); });
  it("plans actions & dedupes", () => {
    expect(rows.map((r) => actionFor(r, "skip"))).toEqual(["create", "skip", "skip", "track", "invalid"]);
    expect(actionFor(rows[2]!, "update")).toBe("update");
    expect(rows[4]!.errors.length).toBeGreaterThanOrEqual(4);
  });
  it("export + template are parseable", () => {
    expect(parseCsv(exportCsv(apps, opps))[1]![0]).toBe(opps[0]!.title);
    expect(parseCsv(templateCsv()).length).toBe(2);
  });
});
