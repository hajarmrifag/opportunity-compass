import { Link } from "@tanstack/react-router";
import type { Opportunity } from "@/domain/types";
import { useStore } from "@/lib/store";
import { CategoryChip, DeadlineText, SourceBadge } from "./ui-bits";
import { CompareButton } from "./CompareButton";

export function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { getApplication, saveOpportunity } = useStore();
  const saved = !!getApplication(opp.id);
  return (
    <article
      className={`atlas-opportunity atlas-category-${opp.category} flex flex-col gap-4 border border-border p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="atlas-card-index" aria-hidden>
          {opp.category.slice(0, 3)}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <CategoryChip opp={opp} />
          <SourceBadge opp={opp} />
        </div>
      </div>
      <div>
        <h3 className="text-2xl leading-[1.05]">
          <Link to="/opportunities/$id" params={{ id: opp.id }} className="hover:underline">
            {opp.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">
          {opp.organization} · {opp.location}
        </p>
      </div>
      <p className="line-clamp-3 text-sm leading-relaxed">{opp.summary}</p>
      <p className="text-sm">
        <DeadlineText iso={opp.deadline} />
      </p>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
        <Link to="/opportunities/$id" params={{ id: opp.id }} className="btn btn-outline btn-sm">
          View brief
        </Link>
        <button
          className="btn btn-sm"
          disabled={saved}
          onClick={() => saveOpportunity(opp.id)}
          aria-pressed={saved}
        >
          {saved ? "✓ Saved" : "Save"}
        </button>
        <CompareButton opportunityId={opp.id} />
      </div>
    </article>
  );
}
