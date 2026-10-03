import { describe, expect, it } from "vitest";
import {
  applicationsDue,
  chatsNeedingAttention,
  funnelCounts,
  interviewsBySource,
  submittedPerWeek,
} from "@/lib/trackerStats";
import type { CoffeeChat, TrackerApplication, TrackerEvent } from "@/lib/tracker.functions";

const app = (p: Partial<TrackerApplication>): TrackerApplication => ({
  id: "a",
  listing_id: "l",
  company: "Co",
  role: "Role",
  status: "saved",
  source: "other",
  applied_date: null,
  notes: "",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...p,
});
const ev = (
  application_id: string,
  status: TrackerEvent["status"],
  date: string,
): TrackerEvent => ({
  id: `${application_id}-${status}`,
  application_id,
  status,
  date,
  source: "manual",
});

describe("tracker dashboard stats", () => {
  const apps = [
    app({ id: "1", status: "interview", source: "referral" }),
    app({ id: "2", status: "rejected", source: "cold" }),
    app({ id: "3", status: "saved" }),
  ];
  const events = [
    ev("2", "submitted", "2026-09-28T10:00:00Z"),
    ev("2", "interview", "2026-09-30T10:00:00Z"),
    ev("2", "rejected", "2026-10-01T10:00:00Z"),
  ];

  it("funnel counts stages reached, including rejected apps' history", () => {
    const f = Object.fromEntries(funnelCounts(apps, events).map((r) => [r.key, r.count]));
    expect(f).toEqual({
      saved: 3,
      submitted: 2,
      assessment: 0,
      interview: 2,
      offer: 0,
      rejected: 1,
    });
  });

  it("interviews by source", () => {
    const s = Object.fromEntries(interviewsBySource(apps, events).map((r) => [r.key, r.count]));
    expect(s).toEqual({ referral: 1, cold: 1, career_fair: 0, other: 0 });
  });

  it("submitted per week uses the submitted event date", () => {
    const rows = submittedPerWeek(apps, events, new Date(2026, 9, 3));
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(1);
  });

  it("due lists include overdue next actions and chats needing notes", () => {
    const due = applicationsDue(
      [
        app({ id: "x", next_action_date: "2026-10-01" }),
        app({ id: "y", next_action_date: "2026-10-09" }),
      ],
      "2026-10-03",
    );
    expect(due.map((a) => a.id)).toEqual(["x"]);
    const chat: CoffeeChat = {
      id: "c",
      contact_name: "S",
      company: "",
      date: "2026-10-02",
      follow_up_date: null,
      notes: "",
      outcome: "",
      created_at: "",
    };
    expect(chatsNeedingAttention([chat], "2026-10-03")[0]?.reason).toBe("Add notes from this chat");
  });
});
