import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, IdCard, RefreshCw, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { getRecommended } from "@/lib/recommended.functions";
import {
  hintsUsable,
  profileHints,
  RECOMMENDED_CATEGORIES,
  type RecommendedCategory,
  type RecommendedResult,
} from "@/lib/recommended";
import { CATEGORY_LABELS } from "@/domain/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { EmptyState, Loading, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/recommended")({
  head: () => ({
    meta: [
      { title: "Recommended for you — Source" },
      {
        name: "description",
        content:
          "Curated live searches per goal, built from your confirmed Passport. Every listing is read from the real web and labelled unverified.",
      },
      { property: "og:title", content: "Recommended for you — Source" },
      {
        property: "og:description",
        content:
          "Curated live searches per goal, built from your confirmed Passport. Every listing is read from the real web and labelled unverified.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecommendedPage,
});

type SectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: RecommendedResult & { ok: true } }
  | { status: "error"; message: string };

function RecommendedPage() {
  const { ready, profile, getOpportunity, addManualOpportunity } = useStore();
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  // One in-flight request per category; abort on re-press (acts as cancel) or unmount.
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const map = controllers.current;
    return () => {
      mounted.current = false;
      map.forEach((ac) => ac.abort());
    };
  }, []);

  if (!ready) return <Loading />;

  const hints = profileHints(profile?.confirmed ? profile : null);
  const usable = hintsUsable(hints);

  const run = async (category: RecommendedCategory) => {
    controllers.current.get(category)?.abort();
    const ac = new AbortController();
    controllers.current.set(category, ac);
    setSections((s) => ({ ...s, [category]: { status: "loading" } }));
    try {
      const result = await getRecommended({ data: { category, hints } });
      if (!mounted.current || ac.signal.aborted) return;
      if (result.ok) {
        // Make listings known to the store so Save, Compare and the detail page work
        // (same pattern as Live search; guarded so refreshes never duplicate).
        for (const opp of result.search.results) {
          if (!getOpportunity(opp.id)) addManualOpportunity(opp);
        }
        setSections((s) => ({ ...s, [category]: { status: "done", result } }));
      } else {
        setSections((s) => ({
          ...s,
          [category]: { status: "error", message: result.error.message },
        }));
      }
    } catch (e) {
      if (!mounted.current || ac.signal.aborted) return;
      setSections((s) => ({
        ...s,
        [category]: {
          status: "error",
          message: e instanceof Error ? e.message : "The search could not complete. Try again.",
        },
      }));
    }
  };

  const cancel = (category: RecommendedCategory) => {
    controllers.current.get(category)?.abort();
    setSections((s) => ({ ...s, [category]: { status: "idle" } }));
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Recommended"
        sub="One focused live search per goal, built only from your confirmed Passport's degree level, field, skills and languages. Nothing personal leaves this browser. Searches run only when you press a button, and every listing is read from the real web and stays labelled unverified."
      />

      {!profile?.confirmed && (
        <section className="atlas-passport-callout" aria-labelledby="rec-passport">
          <span className="atlas-passport-icon" aria-hidden>
            <IdCard />
          </span>
          <div>
            <h2 id="rec-passport">Confirm your Passport first</h2>
            <p>
              Recommendations are shaped by your confirmed degree level, field and skills. Until you
              confirm, searches would be guesswork — so they stay off.
            </p>
          </div>
          <Link to="/passport" className="atlas-text-link">
            Open Passport <ArrowRight aria-hidden />
          </Link>
        </section>
      )}

      {profile?.confirmed && !usable && (
        <EmptyState
          title="Your Passport needs a field or a few skills"
          body="Add your field of study or at least one skill in your Passport, confirm it, then come back — that is all the recommendations use."
          action={
            <Link to="/passport" className="btn">
              Complete Passport
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-10">
        {RECOMMENDED_CATEGORIES.map((category) => (
          <CategorySection
            key={category}
            category={category}
            state={sections[category] ?? { status: "idle" }}
            disabled={!profile?.confirmed || !usable}
            onRun={() => run(category)}
            onCancel={() => cancel(category)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Each search reads a handful of public pages through the linked web search connection and
        uses a small amount of search credit. Results are cached for a few hours; press Refresh to
        search again sooner.
      </p>
    </div>
  );
}

function CategorySection({
  category,
  state,
  disabled,
  onRun,
  onCancel,
}: {
  category: RecommendedCategory;
  state: SectionState;
  disabled: boolean;
  onRun: () => void;
  onCancel: () => void;
}) {
  const label = CATEGORY_LABELS[category];
  const hasResults = state.status === "done";
  return (
    <section className="atlas-section" aria-labelledby={`rec-${category}`}>
      <div className="atlas-section-heading">
        <span className="atlas-section-number" aria-hidden>
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="atlas-kicker">{label}</p>
          <h2 id={`rec-${category}`}>{label} picks</h2>
        </div>
        <div className="flex items-center gap-2">
          {state.status === "loading" ? (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X aria-hidden className="size-3" /> Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onRun}>
              <RefreshCw aria-hidden className="size-3" />
              {hasResults ? "Refresh" : `Find ${label.toLowerCase()}s`}
            </Button>
          )}
        </div>
      </div>

      {state.status === "idle" && (
        <p className="text-sm text-muted-foreground">
          Not searched yet. Press the button to read the live web for {label.toLowerCase()}{" "}
          opportunities that fit your Passport.
        </p>
      )}

      {state.status === "loading" && (
        <p className="text-sm text-muted-foreground" role="status">
          Searching and reading real pages for {label.toLowerCase()} opportunities… this can take up
          to a minute.
        </p>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <span>{state.message}</span>
          <Button variant="outline" size="sm" onClick={onRun}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "done" && (
        <>
          <p className="text-xs text-muted-foreground">
            {state.result.search.results.length} listing
            {state.result.search.results.length === 1 ? "" : "s"} · read{" "}
            {new Date(state.result.search.retrievedAt).toLocaleString()}
            {state.result.search.cached ? " · from cache" : ""} · From live web · unverified
          </p>
          {state.result.search.results.length === 0 ? (
            <EmptyState
              title={`No ${label.toLowerCase()} listings found this time`}
              body="The pages found were not single, specific opportunities, or none matched. Try Refresh later, or use Live search with your own words."
              action={
                <Link to="/search" className="btn btn-outline">
                  Open Live search
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {state.result.search.results.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
