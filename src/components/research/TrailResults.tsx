import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Opportunity } from "@/domain/types";
import { CATEGORY_LABELS } from "@/domain/types";
import type { ResearchTrailState, TrailSourceState } from "@/lib/researchTrail";
import { useStore } from "@/lib/store";
import { DeadlineText } from "@/components/ui-bits";
import { CompareButton } from "@/components/CompareButton";
import { duration, spring, staggerContainer } from "@/lib/motion";

/**
 * Surviving candidates, ranked. Each one keeps the page it came from and the
 * sentences that produced its facts, so the provenance never gets detached
 * from the result.
 */
export function TrailResults({
  state,
  opportunities,
}: {
  state: ResearchTrailState;
  opportunities: Record<string, Opportunity>;
}) {
  const reduced = useReducedMotion();
  if (state.rankedIds.length === 0) return null;

  const rows = state.rankedIds
    .map((candidateId) => {
      const candidate = state.candidates.find((c) => c.id === candidateId);
      const source = state.sources.find((s) => s.id === candidate?.sourceId) ?? null;
      const opportunity = opportunities[candidateId];
      return candidate && opportunity ? { candidateId, source, opportunity } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <motion.section
      className="atlas-trail-results"
      aria-label="Research results"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.arrive}
    >
      <div className="atlas-section-heading">
        <span className="atlas-section-number">{String(rows.length).padStart(2, "0")}</span>
        <div>
          <p className="atlas-kicker">Survived review</p>
          <h2>What the agent kept</h2>
        </div>
      </div>

      <motion.ol
        className="atlas-result-list space-y-5"
        variants={staggerContainer(0.09)}
        initial="hidden"
        animate="visible"
      >
        {rows.map((row, index) => (
          <ResultRow
            key={row.candidateId}
            index={index + 1}
            opportunity={row.opportunity}
            source={row.source}
            reduced={!!reduced}
          />
        ))}
      </motion.ol>
    </motion.section>
  );
}

function ResultRow({
  opportunity,
  source,
  index,
  reduced,
}: {
  opportunity: Opportunity;
  source: TrailSourceState | null;
  index: number;
  reduced: boolean;
}) {
  const { getApplication, getOpportunity, addManualOpportunity, saveOpportunity } = useStore();
  const [showEvidence, setShowEvidence] = useState(false);
  const saved = !!getApplication(opportunity.id);

  const ensureStored = () => {
    if (!getOpportunity(opportunity.id)) addManualOpportunity(opportunity);
  };
  const save = () => {
    ensureStored();
    saveOpportunity(opportunity.id);
  };

  return (
    <motion.li
      layout
      className={`atlas-live-result atlas-category-${opportunity.category} border border-border p-5 md:p-7`}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={spring.arrive}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="atlas-result-number">{String(index).padStart(2, "0")}</span>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="chip chip-teal">{CATEGORY_LABELS[opportunity.category]}</span>
          <span className="chip chip-demo">Demo data</span>
        </div>
      </div>

      <h3 className="max-w-4xl text-2xl leading-tight md:text-4xl">{opportunity.title}</h3>
      <p className="text-sm text-muted-foreground">
        {opportunity.organization} · {opportunity.location} ·{" "}
        {opportunity.mode.replace("_", " ")}
      </p>
      <p className="mt-4 max-w-4xl text-sm leading-relaxed">{opportunity.summary}</p>
      <p className="mt-2 text-sm">
        <DeadlineText iso={opportunity.deadline} />
      </p>

      {source && (
        <div className="atlas-provenance">
          <button
            type="button"
            className="atlas-provenance-toggle"
            aria-expanded={showEvidence}
            onClick={() => setShowEvidence((open) => !open)}
          >
            <span className="atlas-card-index">Evidence</span>
            <span className="atlas-provenance-host">{source.host}</span>
            <span className="atlas-provenance-count">
              {source.evidence.length} fact{source.evidence.length === 1 ? "" : "s"} extracted
            </span>
            <span aria-hidden className={showEvidence ? "is-open" : ""}>
              ▾
            </span>
          </button>
          <AnimatePresence initial={false}>
            {showEvidence && (
              <motion.ul
                className="atlas-provenance-list"
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: duration.base, ease: [0.2, 0.75, 0.2, 1] }}
              >
                {source.evidence.map((item) => (
                  <li key={item.id}>
                    <span className="atlas-evidence-field">{item.field}</span>
                    <strong>{item.value}</strong>
                    <q>{item.sentence}</q>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button className="btn btn-sm" disabled={saved} onClick={save} aria-pressed={saved}>
          {saved ? "✓ Saved" : "Save to My Journey"}
        </button>
        <CompareButton opportunityId={opportunity.id} opportunity={opportunity} />
        <Link
          to="/opportunities/$id"
          params={{ id: opportunity.id }}
          className="btn btn-ghost btn-sm"
          onClick={ensureStored}
        >
          View brief
        </Link>
      </div>
    </motion.li>
  );
}
