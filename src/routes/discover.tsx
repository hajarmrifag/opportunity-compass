import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_LABELS, type Category } from "@/domain/types";
import { EmptyState, Loading, PageHeader } from "@/components/ui-bits";
import { OpportunityCard } from "@/components/OpportunityCard";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Source" },
      {
        name: "description",
        content: "Search internships, scholarships, research, exchanges and fellowships.",
      },
      { property: "og:title", content: "Discover — Source" },
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
        title="Demo listings"
        sub="Fictional, unverified examples for testing. Use Live search for real opportunities."
      />
      <div className="atlas-search-workbench mb-6 grid gap-3 border-y border-foreground py-5 md:grid-cols-[1fr_auto]">
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
        <div className="atlas-filter-grid md:col-span-2" role="group" aria-label="Category">
          {(["all", ...cats] as const).map((c) => {
            const n =
              c === "all"
                ? opportunities.length
                : opportunities.filter((o) => o.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`btn btn-sm ${cat === c ? "" : "btn-outline"}`}
              >
                {c === "all" ? "All" : CATEGORY_LABELS[c]} ({n})
              </button>
            );
          })}
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {results.length} result{results.length === 1 ? "" : "s"}
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
        <div className="atlas-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((o) => (
            <OpportunityCard key={o.id} opp={o} />
          ))}
        </div>
      )}
    </>
  );
}
