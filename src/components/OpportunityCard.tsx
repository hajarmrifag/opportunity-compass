import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { Opportunity } from "@/domain/types";
import { CATEGORY_LABELS } from "@/domain/types";
import { useStore } from "@/lib/store";
import { DeadlineText, SourceBadge } from "./ui-bits";
import { CompareButton } from "./CompareButton";
import { SaveToTrackerButton } from "./SaveToTrackerButton";
import { spring } from "@/lib/motion";

export function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { getApplication, saveOpportunity } = useStore();
  const reduced = useReducedMotion();
  const saved = !!getApplication(opp.id);

  return (
    <motion.article
      layout
      className={`atlas-opportunity atlas-category-${opp.category}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={spring.settle}
    >
      <p className="atlas-opportunity-meta">
        <span>{CATEGORY_LABELS[opp.category]}</span>
        <SourceBadge opp={opp} />
      </p>

      <h3>
        <Link to="/opportunities/$id" params={{ id: opp.id }}>
          {opp.title}
        </Link>
      </h3>
      <p className="atlas-opportunity-org">
        {opp.organization} · {opp.location}
      </p>
      <p className="atlas-opportunity-summary">{opp.summary}</p>
      <p className="atlas-opportunity-deadline">
        <DeadlineText iso={opp.deadline} />
      </p>

      <div className="atlas-opportunity-actions">
        <Link to="/opportunities/$id" params={{ id: opp.id }}>
          Open
        </Link>
        <button type="button" disabled={saved} onClick={() => saveOpportunity(opp.id)}>
          {saved ? "Saved" : "Save"}
        </button>
        <CompareButton opportunityId={opp.id} quiet />
        <SaveToTrackerButton opp={opp} quiet />
      </div>
    </motion.article>
  );
}
