import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { deadlineState, safeHttpUrl } from "@/lib/validation";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { STATUS_LABELS } from "@/domain/types";
import {
  CategoryChip,
  CoverageChip,
  DeadlineText,
  EmptyState,
  Loading,
  ReqStatus,
  SourceBadge,
} from "@/components/ui-bits";
import { CompareButton } from "@/components/CompareButton";

export const Route = createFileRoute("/opportunities/$id")({
  head: () => ({
    meta: [
      { title: "Opportunity details — OpportunityOS" },
      {
        name: "description",
        content: "Eligibility, relevance and funding coverage for an opportunity.",
      },
      { property: "og:title", content: "Opportunity details — OpportunityOS" },
      {
        property: "og:description",
        content: "Eligibility, relevance and funding coverage for an opportunity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

const OVERALL = {
  meets_listed_criteria: {
    t: "Meets all listed demo criteria",
    d: "This is not a guarantee of eligibility. Always confirm with the provider.",
  },
  not_eligible: { t: "One or more criteria not met", d: "Based on your confirmed Passport." },
  incomplete: {
    t: "Eligibility incomplete",
    d: "Some criteria are unknown. Missing information never counts as met.",
  },
};

function Detail() {
  const { id } = Route.useParams();
  const { ready, getOpportunity, profile, getApplication, saveOpportunity, pendingProfileEdits } =
    useStore();
  if (!ready) return <Loading />;
  const opp = getOpportunity(id);
  if (!opp)
    return (
      <EmptyState
        title="Opportunity not found"
        body="It may have been removed from this browser."
        action={
          <Link to="/discover" className="btn">
            Back to Discover
          </Link>
        }
      />
    );

  const result = demoEligibilityAdapter.evaluate(profile, opp);
  const app = getApplication(opp.id);
  const o = OVERALL[result.overall];
  const f = opp.funding;
  const timing = deadlineState(opp.deadline);
  const applyUrl = safeHttpUrl(opp.applyUrl);
  const sourceUrl = safeHttpUrl(opp.sourceUrl);

  return (
    <>
      <Link to="/discover" className="text-sm text-muted-foreground hover:underline">
        ← Discover
      </Link>
      <header className="atlas-detail-hero mt-3 mb-8 border-b border-border pb-8">
        <div className="mb-2 flex flex-wrap gap-2">
          <CategoryChip opp={opp} />
          <SourceBadge opp={opp} />
        </div>
        <h1 className="mt-4 max-w-5xl font-display text-4xl leading-[0.95] uppercase md:text-7xl">
          {opp.title}
        </h1>
        <p className="text-muted-foreground">
          {opp.organization} · {opp.location} · {opp.mode.replace("_", " ")}
        </p>
        <p className="mt-2 text-sm">
          <DeadlineText iso={opp.deadline} />
        </p>
        {(timing.state === "expired" || timing.state === "invalid") && (
          <p role="note" className="mt-3 rounded-lg bg-warning-soft p-3 text-sm">
            {timing.state === "expired"
              ? "This deadline has passed."
              : "The listed deadline is not a valid date."}{" "}
            This is about timing only — it does not change the eligibility results below.
          </p>
        )}
      </header>

      <div className="atlas-detail-grid grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="atlas-detail-summary border-y border-foreground py-7">
            <p className="max-w-4xl font-editorial text-2xl leading-relaxed">{opp.summary}</p>
          </section>

          <section
            className="atlas-fact-section border-t border-border pt-6"
            aria-labelledby="elig"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="elig" className="text-xl">
                Eligibility
              </h2>
              <span className="chip chip-muted">{result.basis}</span>
            </div>
            {profile?.confirmed && (
              <p className="mt-1 text-xs text-muted-foreground">
                Checked against your Passport confirmed{" "}
                {profile.confirmedAt ? new Date(profile.confirmedAt).toLocaleString() : ""}.
              </p>
            )}
            {pendingProfileEdits && (
              <p role="status" className="mt-2 rounded-lg bg-warning-soft p-3 text-sm">
                You have unsaved Passport edits. These results reflect your{" "}
                {profile?.confirmed ? "last confirmed" : "saved"} Passport, not your edits.{" "}
                <Link to="/passport" className="underline">
                  Review and confirm
                </Link>{" "}
                to update them.
              </p>
            )}
            <p className="mt-2 font-semibold">{o.t}</p>
            <p className="text-sm text-muted-foreground">{o.d}</p>
            {!profile?.confirmed && (
              <Link to="/passport" className="btn btn-sm mt-3">
                Confirm Passport to check
              </Link>
            )}
            <ul className="mt-4 divide-y divide-border">
              {result.requirements.map((r) => (
                <li
                  key={r.requirement.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <div className="font-medium">{r.requirement.label}</div>
                    <div className="text-sm text-muted-foreground">{r.reason}</div>
                  </div>
                  <ReqStatus s={r.status} />
                </li>
              ))}
              {result.requirements.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  No criteria listed — check with the provider.
                </li>
              )}
            </ul>
          </section>

          <section className="atlas-fact-section border-t border-border pt-6" aria-labelledby="rel">
            <h2 id="rel" className="text-xl">
              Relevance to you{" "}
              <span className="chip chip-teal ml-2 align-middle capitalize">
                {result.relevance.level}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Separate from eligibility — how well this fits your preferences.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm">
              {result.relevance.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>

          <section
            className="atlas-fact-section border-t border-border pt-6"
            aria-labelledby="fund"
          >
            <h2 id="fund" className="text-xl">
              Funding coverage
            </h2>
            <dl className="mt-3 divide-y divide-border">
              {(["tuition", "living", "travel"] as const).map((k) => (
                <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <dt className="font-medium">
                    {k === "living" ? "Living costs" : k === "tuition" ? "Tuition" : "Travel"}
                    {profile?.fundingNeeds[k] && (
                      <span className="ml-2 text-xs text-primary">(you need this)</span>
                    )}
                    {f[k].note && (
                      <div className="text-sm font-normal text-muted-foreground">{f[k].note}</div>
                    )}
                  </dt>
                  <dd>
                    <CoverageChip s={f[k].status} />
                  </dd>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <dt className="font-medium">Payment timing</dt>
                <dd>{f.paymentTiming ?? <CoverageChip s="unknown" />}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="atlas-detail-actions space-y-3 border border-foreground bg-acid p-5">
            {app ? (
              <>
                <p className="text-sm">
                  Tracking · <strong>{STATUS_LABELS[app.status]}</strong>
                </p>
                <Link to="/journey" className="btn w-full">
                  Update in My Journey
                </Link>
              </>
            ) : (
              <button className="btn w-full" onClick={() => saveOpportunity(opp.id)}>
                Save to My Journey
              </button>
            )}
            <CompareButton opportunityId={opp.id} />
            {applyUrl ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-full"
              >
                Open application site ↗
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                No application link available{opp.isDemo ? " for demo data" : ""}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Opening a link never marks you as Submitted — set that yourself in My Journey.
            </p>
          </div>
          <div className="border border-foreground bg-card p-5 text-sm">
            <h2 className="mb-2 text-base">Source & verification</h2>
            <p>
              Source:{" "}
              {sourceUrl ? (
                <a className="underline" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  link
                </a>
              ) : (
                "None"
              )}
            </p>
            <p>Last verified: {opp.lastVerified ?? "Never — unverified"}</p>
            {opp.isDemo && (
              <p className="mt-2 text-demo">Fictional demo listing for testing only.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
