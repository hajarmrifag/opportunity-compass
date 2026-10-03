import { Link } from "@tanstack/react-router";
import type { Opportunity } from "@/domain/types";
import { useStore } from "@/lib/store";
import { CategoryChip, DeadlineText, SourceBadge } from "./ui-bits";

export function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { getApplication, saveOpportunity } = useStore();
  const saved = !!getApplication(opp.id);
  return (
    <article className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap gap-2"><CategoryChip opp={opp} /><SourceBadge opp={opp} /></div>
      <div>
        <h3 className="text-lg leading-snug">
          <Link to="/opportunities/$id" params={{ id: opp.id }} className="hover:underline">{opp.title}</Link>
        </h3>
        <p className="text-sm text-muted-foreground">{opp.organization} · {opp.location}</p>
      </div>
      <p className="line-clamp-2 text-sm">{opp.summary}</p>
      <p className="text-sm"><DeadlineText iso={opp.deadline} /></p>
      <div className="mt-auto flex gap-2 pt-2">
        <Link to="/opportunities/$id" params={{ id: opp.id }} className="btn btn-outline btn-sm">View details</Link>
        <button className="btn btn-sm" disabled={saved} onClick={() => saveOpportunity(opp.id)} aria-pressed={saved}>
          {saved ? "✓ Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}
