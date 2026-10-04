import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { CATEGORY_LABELS, type Category } from "@/domain/types";
import { EmptyState, Loading, PageHeader } from "@/components/ui-bits";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Counter } from "@/components/motion/Counter";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Browse · Sourced" },
      {
        name: "description",
        content: "Search internships, scholarships, research, exchanges and fellowships.",
      },
      { property: "og:title", content: "Browse · Sourced" },
      {
        property: "og:description",
        content: "Search internships, scholarships, research, exchanges and fellowships.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

type Funding = "any" | "tuition" | "living" | "travel";

function Discover() {
  const { ready, opportunities } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [funding, setFunding] = useState<Funding>("any");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (cat !== "all" && o.category !== cat) return false;
      if (funding !== "any" && o.funding[funding].status !== "covered") return false;
      if (!s) return true;
      return [o.title, o.organization, o.summary, o.location, ...o.tags]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [opportunities, q, cat, funding]);

  if (!ready) return <Loading />;
  const cats = Object.keys(CATEGORY_LABELS) as Category[];

  return (
    <>
      <PageHeader
        kicker="Field"
        title="Browse"
        sub="Fictional examples for testing. Use Search for real opportunities."
      />
      <div className="atlas-search-workbench mb-6 grid gap-3 border-y py-5 md:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="q">Search</label>
          <input
            id="q"
            type="search"
            placeholder="Title, organization, skill…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="funding">Funding fully covers</label>
          <select
            id="funding"
            value={funding}
            onChange={(e) => setFunding(e.target.value as Funding)}
          >
            <option value="any">Any</option>
            <option value="tuition">Tuition</option>
            <option value="living">Living costs</option>
            <option value="travel">Travel</option>
          </select>
        </div>
        <LayoutGroup id="discover-filters">
          <div className="atlas-filter-grid md:col-span-2" role="group" aria-label="Category">
            {(["all", ...cats] as const).map((c) => {
              const n =
                c === "all"
                  ? opportunities.length
                  : opportunities.filter((o) => o.category === c).length;
              const active = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  aria-pressed={active}
                  className={`atlas-filter-pill ${active ? "is-active" : ""}`}
                >
                  {/* One indicator slides between pills instead of each one toggling. */}
                  {active && (
                    <motion.span
                      layoutId="discover-filter-active"
                      className="atlas-filter-pill-bg"
                      transition={{ type: "spring", stiffness: 480, damping: 40 }}
                    />
                  )}
                  <span>{c === "all" ? "All" : CATEGORY_LABELS[c]}</span>
                  <b>{n}</b>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
      <p className="mb-4 flex items-baseline gap-2 text-sm text-muted-foreground" aria-live="polite">
        <span className="atlas-result-number">
          <Counter value={results.length} duration={0.35} />
        </span>{" "}
        result{results.length === 1 ? "" : "s"} in view
      </p>
      {results.length === 0 ? (
        <EmptyState
          title="No matches"
          body="Try a different search or clear filters. “Unknown” funding is excluded from funding filters."
          action={
            <button
              className="btn btn-outline"
              onClick={() => {
                setQ("");
                setCat("all");
                setFunding("any");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <LayoutGroup id="discover-field">
          <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {results.map((o) => (
                <OpportunityCard key={o.id} opp={o} />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      )}
    </>
  );
}
