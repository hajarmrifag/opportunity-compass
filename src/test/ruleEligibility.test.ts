// FICTIONAL test data only.
import { describe, expect, it } from "vitest";
import { evaluateRules } from "@/adapters/ruleEligibility";
import { EMPTY_PROFILE } from "@/data/fixtures";
import type { Opportunity, Profile, Requirement } from "@/domain/types";

const NOW = new Date(2026, 9, 3, 12);
const P: Profile = {
  ...EMPTY_PROFILE,
  fullName: "TEST student",
  degreeLevel: "bachelor",
  field: "Computer Science",
  graduationYear: 2027,
  skills: ["Python"],
  languages: ["English"],
  gpaValue: "3.6",
  gpaScale: "4.0",
  preferences: { categories: ["internship"], locations: ["Lisbon"], remoteOk: true },
  confirmed: true,
  confirmedAt: "2026-10-01T00:00:00Z",
};
const opp = (requirements: Requirement[], extra: Partial<Opportunity> = {}): Opportunity => ({
  id: "test-opp",
  title: "TEST Data Internship",
  organization: "TEST Org (fictional)",
  category: "internship",
  location: "Lisbon",
  mode: "hybrid",
  summary: "Fictional",
  deadline: "2026-12-01",
  tags: ["computer science", "python"],
  requirements,
  funding: {
    tuition: { status: "unknown" },
    living: { status: "unknown" },
    travel: { status: "unknown" },
    paymentTiming: null,
  },
  sourceUrl: null,
  applyUrl: null,
  lastVerified: null,
  verification: "user_entered",
  isDemo: false,
  ...extra,
});
const deg = (v: string[], x: Partial<Requirement> = {}): Requirement => ({
  id: `d${v}`,
  kind: "degreeLevel",
  label: "Degree",
  values: v,
  ...x,
});
const ev = (o: Opportunity, p: Profile | null = P) => evaluateRules(p, o, NOW);

describe("rule eligibility engine", () => {
  it("all pass", () =>
    expect(
      ev(opp([deg(["bachelor"]), { id: "s", kind: "skill", label: "Python", values: ["python"] }]))
        .overall,
    ).toBe("meets_listed_criteria"));
  it("one mandatory fail", () => expect(ev(opp([deg(["master"])])).overall).toBe("not_eligible"));
  it("missing value is unknown", () => {
    const r = ev(opp([deg(["bachelor"])]), { ...P, degreeLevel: null });
    expect(r.overall).toBe("incomplete");
    expect(r.requirements[0]!.studentValue).toBe("Not provided");
  });
  it("fail + unknown → not eligible", () =>
    expect(
      ev(opp([deg(["master"]), { id: "o", kind: "other", label: "Work rights" }])).overall,
    ).toBe("not_eligible"));
  it("OR group one pass + one unknown → pass, other not applicable", () => {
    const r = ev(
      opp([
        deg(["bachelor"], { groupId: "g", groupLogic: "OR" }),
        { id: "o", kind: "other", label: "Equivalent", groupId: "g", groupLogic: "OR" },
      ]),
    );
    expect(r.overall).toBe("meets_listed_criteria");
    expect(r.requirements[1]!.detailStatus).toBe("not_applicable");
  });
  it("OR group all unknown → needs confirmation", () => {
    const r = ev(
      opp([
        { id: "a", kind: "other", label: "A", groupId: "g", groupLogic: "OR" },
        { id: "b", kind: "other", label: "B", groupId: "g", groupLogic: "OR" },
      ]),
    );
    expect(r.overall).toBe("incomplete");
  });
  it("deadline today is still open", () =>
    expect(ev(opp([], { deadline: "2026-10-03" })).deadline!.state).toBe("closing_soon"));
  it("deadline yesterday is Closed, eligibility unchanged", () => {
    const r = ev(opp([deg(["bachelor"])], { deadline: "2026-10-02" }));
    expect(r.deadline!.state).toBe("expired");
    expect(r.overall).toBe("meets_listed_criteria");
  });
  it("unknown deadline is not Closed", () =>
    expect(ev(opp([], { deadline: null })).deadline!.state).toBe("unknown"));
  it("GPA same scale compares, different scale unknown", () => {
    const g = (scale: string, min: number) =>
      opp([{ id: "g", kind: "other", label: "GPA", gpa: { min, scale } }]);
    expect(ev(g("4.0", 3.0)).overall).toBe("meets_listed_criteria");
    expect(ev(g("4.0", 3.8)).overall).toBe("not_eligible");
    expect(ev(g("10", 7)).overall).toBe("incomplete");
  });
  it("preferred failure does not change status", () => {
    const r = ev(opp([deg(["bachelor"]), deg(["master"], { id: "p", importance: "preferred" })]));
    expect(r.overall).toBe("meets_listed_criteria");
    expect(r.notes!.some((n) => n.startsWith("Preferred"))).toBe(true);
  });
  it("strong relevance with Not eligible stays Not eligible", () => {
    const r = ev(opp([deg(["phd"])]));
    expect(r.relevance.band).toBe("strong");
    expect(r.overall).toBe("not_eligible");
  });
  it("changed Passport field changes result and version", () => {
    const o = opp([{ id: "f", kind: "field", label: "Field", values: ["biology"] }]);
    const a = ev(o);
    const b = ev(o, { ...P, field: "Biology" });
    expect(a.overall).toBe("not_eligible");
    expect(b.overall).toBe("meets_listed_criteria");
    expect(a.profileVersion).not.toBe(b.profileVersion);
  });
  it("missing requirement text is unknown", () =>
    expect(ev(opp([{ id: "x", kind: "other", label: "" }])).overall).toBe("incomplete"));
  it("zero requirements → needs confirmation", () =>
    expect(ev(opp([])).overall).toBe("incomplete"));
  it("unconfirmed Passport → all unknown", () => {
    const r = ev(opp([deg(["bachelor"])]), { ...P, confirmed: false });
    expect(r.overall).toBe("incomplete");
    expect(r.requirements.every((x) => x.status === "unknown")).toBe(true);
    expect(r.relevance.band).toBe("not_enough_information");
  });
  it("live-search listing with many items does not force Not eligible", () => {
    const reqs: Requirement[] = [
      deg(["master"]),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `o${i}`,
        kind: "other" as const,
        label: `Item ${i}`,
      })),
    ];
    const r = ev(opp(reqs, { verification: "web_retrieved", sourceUrl: "https://example.org" }));
    expect(r.overall).toBe("incomplete");
    expect(r.notes!.filter((n) => n.startsWith("Needs verification")).length).toBe(9);
    expect(r.basis).toMatch(/not human-verified/);
  });
  it("demo basis stays truthful", () =>
    expect(ev(opp([], { isDemo: true })).basis).toBe("Based on demo criteria"));
});
