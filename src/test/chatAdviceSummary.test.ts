import { describe, expect, it } from "vitest";
import { summarizeChatsForAdvice } from "@/lib/tracker.functions";

const base = {
  contact_name: "Sarah Lee",
  company: "Acme",
  date: "2026-09-10",
  notes: "",
};

describe("summarizeChatsForAdvice", () => {
  it("counts outcomes and referral yes/no from the chats", () => {
    const summary = summarizeChatsForAdvice([
      {
        ...base,
        outcome: "successful_referral",
        referral: true,
        notes: "Referred me to the team.",
      },
      { ...base, contact_name: "B", outcome: "ghosted", referral: false, notes: "No reply." },
      { ...base, contact_name: "C", outcome: "ghosted", referral: false, notes: "" },
      { ...base, contact_name: "D", outcome: "", referral: true, notes: "" }, // defaults to planned
    ]);
    expect(summary.outcomeCounts).toEqual({
      successful_referral: 1,
      ghosted: 2,
      planned: 1,
    });
    expect(summary.referralYes).toBe(2);
    expect(summary.referralNo).toBe(2);
  });

  it("includes the student's comments (bounded) so the advisor can spot problems", () => {
    const long = "x".repeat(500);
    const summary = summarizeChatsForAdvice([
      { ...base, contact_name: "B", outcome: "follow_up_ghosted", referral: false, notes: long },
    ]);
    const first = summary.summaries[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first).toMatchObject({
      contact: "B",
      outcome: "follow_up_ghosted",
      referral: "no",
    });
    expect(first.comment).toHaveLength(200);
  });

  it("handles an empty chat list", () => {
    const summary = summarizeChatsForAdvice([]);
    expect(summary).toEqual({
      outcomeCounts: {},
      referralYes: 0,
      referralNo: 0,
      summaries: [],
    });
  });
});
