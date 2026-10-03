import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackerInsights } from "@/features/tracker/Insights";
import type { TrackerApplication } from "@/lib/tracker.functions";

afterEach(cleanup);

const app: TrackerApplication = {
  id: "test-record",
  listing_id: "test-listing",
  role: "Test internship",
  company: "Test organisation",
  status: "submitted",
  source: "other",
  applied_date: null,
  notes: "",
  created_at: "2026-10-03T12:00:00Z",
  updated_at: "2026-10-03T12:00:00Z",
};

describe("Tracker insights", () => {
  it("renders only the AI feedback button, no chart", () => {
    render(
      <TrackerInsights
        apps={[app]}
        chats={[]}
        onAdvice={async () => ({ advice: "Keep going.", resources: [] })}
      />,
    );
    expect(screen.getByRole("button", { name: /AI feedback/i })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/Application outcomes/i)).not.toBeInTheDocument();
  });

  it("shows AI feedback after the button is used", async () => {
    const user = userEvent.setup();
    const onAdvice = vi.fn(async () => ({ advice: "Keep going.", resources: [] }));
    render(<TrackerInsights apps={[app]} chats={[]} onAdvice={onAdvice} />);
    await user.click(screen.getByRole("button", { name: /AI feedback/i }));
    expect(onAdvice).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Keep going.")).toBeInTheDocument();
  });

  it("falls back to the labelled preview when AI feedback fails", async () => {
    const user = userEvent.setup();
    render(
      <TrackerInsights apps={[app]} chats={[]} onAdvice={async () => Promise.reject(new Error())} />,
    );
    await user.click(screen.getByRole("button", { name: /AI feedback/i }));
    expect(
      await screen.findByText(/Preview — AI feedback isn't connected yet/i),
    ).toBeInTheDocument();
```
  });
});
