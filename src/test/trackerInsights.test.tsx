import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

describe("Tracker live charts", () => {
  it("shows zero, not sample outcomes, for empty records", () => {
    render(
      <TrackerInsights
        apps={[]}
        chats={[]}
        suggestionsCount={0}
        onAdvice={async () => ({ advice: "", resources: [] })}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/0 tracked applications/);
    expect(screen.getByText("No rejections recorded.")).toBeInTheDocument();
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });

  it("updates the chart and rejected list when current records change", () => {
    const props = {
      chats: [],
      suggestionsCount: 2,
      onAdvice: async () => ({ advice: "", resources: [] }),
    };
    const { rerender } = render(<TrackerInsights {...props} apps={[app]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Submitted: 1/);
    expect(screen.queryByText(app.role)).not.toBeInTheDocument();
    rerender(<TrackerInsights {...props} apps={[{ ...app, status: "rejected" }]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Rejected: 1/);
    expect(screen.getByText(app.role)).toBeInTheDocument();
    expect(screen.getByText(app.company)).toBeInTheDocument();
    expect(screen.getByText(/2 pending email suggestions are excluded/)).toBeInTheDocument();
  });
});
