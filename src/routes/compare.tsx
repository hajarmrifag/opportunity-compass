import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import {
  CoverageChip,
  DeadlineText,
  EmptyState,
  PageHeader,
  SourceBadge,
} from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { safeHttpUrl } from "@/lib/validation";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare opportunities · Sourced" },
      {
        name: "description",
        content: "Compare shortlisted opportunities using stated source facts.",
      },
      { property: "og:title", content: "Compare opportunities · Sourced" },
      {
        property: "og:description",
        content: "Compare shortlisted opportunities using stated source facts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { compareIds, getOpportunity, profile, removeCompare } = useStore();
  const [highlight, setHighlight] = useState(true);
  const opportunities = compareIds.map(getOpportunity).filter((value) => value !== undefined);
  if (opportunities.length < 2)
    return (
      <>
        <PageHeader
          title="Compare opportunities"
          sub="Review facts side by side without turning unknowns into assumptions."
        />
        <EmptyState
          title="Choose at least two"
          body="Add opportunities from Live search, demo listings, or saved cards. You can compare up to three."
          action={
            <Link to="/search" className="btn">
              Find opportunities
            </Link>
          }
        />
      </>
    );
  const different = (values: string[]) => highlight && new Set(values).size > 1;
  const locations = opportunities.map((o) => o.location || "Not stated");
  const deadlines = opportunities.map((o) => o.deadline ?? "Not stated");
  return (
    <>
      <PageHeader
        title="Compare opportunities"
        sub="Facts from each listing. Live web results are retrieved, not human-verified."
        right={
          <label className="flex items-center gap-2 font-normal">
            <input
              className="w-auto"
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
            />{" "}
            Highlight differences
          </label>
        }
      />
      <div className="atlas-decision-board pb-6">
        <div className={`atlas-compare-grid atlas-compare-columns-${opportunities.length}`}>
          {opportunities.map((opp, index) => {
            const eligibility = demoEligibilityAdapter.evaluate(profile, opp);
            const source = safeHttpUrl(opp.sourceUrl);
            return (
              <article
                key={opp.id}
                className="atlas-compare-column border border-border bg-card p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <span className="atlas-result-number">0{index + 1}</span>
                    <div className="mt-2">
                      <SourceBadge opp={opp} />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeCompare(opp.id)}>
                    Remove
                  </Button>
                </div>
                <h2 className="atlas-compare-title mt-5 text-2xl leading-tight">
                  <Link
                    to="/opportunities/$id"
                    params={{ id: opp.id }}
                    className="hover:underline"
                    aria-label={`View brief for ${opp.title}`}
                  >
                    {opp.title}
                  </Link>
                </h2>
                <p className="atlas-compare-provider text-sm text-muted-foreground">
                  {opp.organization || "Provider not stated"}
                </p>
                <dl className="atlas-fact-grid mt-5 divide-y divide-border text-sm">
                  <Row
                    label="Type"
                    value={opp.category}
                    highlight={different(opportunities.map((o) => o.category))}
                  />
                  <Row
                    label="Location"
                    value={locations[index] ?? "Not stated"}
                    highlight={different(locations)}
                  />
                  <div
                    className={`atlas-fact-row py-3 ${different(deadlines) ? "bg-accent/50" : ""}`}
                  >
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">
                      Deadline
                    </dt>
                    <dd>
                      <DeadlineText iso={opp.deadline} />
                    </dd>
                  </div>
                  <Row
                    label="Eligibility"
                    value={
                      eligibility.overall === "incomplete"
                        ? "Needs verification"
                        : eligibility.overall === "not_eligible"
                          ? "Listed criterion not met"
                          : "Meets listed criteria. Verify"
                    }
                    highlight={false}
                  />
                  {(["tuition", "living", "travel"] as const).map((key) => (
                    <div key={key} className="atlas-fact-row py-3">
                      <dt className="text-xs font-semibold capitalize text-muted-foreground">
                        {key}
                      </dt>
                      <dd>
                        <CoverageChip s={opp.funding[key].status} />
                      </dd>
                    </div>
                  ))}
                  <Row
                    label="Payment timing"
                    value={opp.funding.paymentTiming ?? "Not stated"}
                    highlight={false}
                  />
                  <Row
                    label="Retrieved"
                    value={
                      opp.retrievedAt ? new Date(opp.retrievedAt).toLocaleString() : "Not stated"
                    }
                    highlight={false}
                  />
                </dl>
                <div className="mt-4">
                  {source ? (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline w-full"
                    >
                      Open source ↗
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Source unavailable. Needs verification.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className={`atlas-fact-row py-3 ${highlight ? "bg-accent/50" : ""}`}>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value.replace("_", " ")}</dd>
    </div>
  );
}
