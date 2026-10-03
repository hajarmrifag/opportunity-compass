import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  PHASE_LABELS,
  isRunning,
  trailTally,
  type ResearchTrailState,
} from "@/lib/researchTrail";
import { duration, spring, staggerContainer } from "@/lib/motion";
import { Counter } from "@/components/motion/Counter";
import { SourceCard } from "./SourceCard";

/**
 * The live research board. Renders whatever the attached driver has reported so
 * far — it is identical for a replayed run and (later) a real streamed one.
 */
export function EvidenceTrail({
  state,
  onCancel,
}: {
  state: ResearchTrailState;
  onCancel?: () => void;
}) {
  const reduced = useReducedMotion();
  const tally = trailTally(state);
  const live = isRunning(state.phase);
  if (state.phase === "idle") return null;

  // Rejected and discarded pages leave the board once their verdict has been read.
  const board = state.sources.filter((s) => s.status !== "rejected");
  const candidateFor = (id: string | null) =>
    id ? (state.candidates.find((c) => c.id === id) ?? null) : null;

  return (
    <section className="atlas-trail" aria-label="Research evidence trail">
      <header className="atlas-trail-head">
        <div className="atlas-trail-heading">
          <span className="atlas-kicker">
            {state.mode === "replay" ? "Recorded run · replay" : "Live research"}
          </span>
          <h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={state.phase}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
                transition={{ duration: duration.base, ease: [0.2, 0.75, 0.2, 1] }}
                className="block"
              >
                {PHASE_LABELS[state.phase]}
              </motion.span>
            </AnimatePresence>
          </h2>
          <p className="atlas-trail-query">“{state.query}”</p>
        </div>

        <dl className="atlas-trail-tally">
          <Tally label="Pages read" value={tally.read} />
          <Tally label="Kept" value={tally.kept} tone="kept" />
          <Tally label="Rejected" value={tally.rejected} tone="rejected" />
          <Tally label="Queries" value={tally.queries} />
        </dl>

        {live && onCancel && (
          <button type="button" className="btn btn-outline btn-sm atlas-trail-stop" onClick={onCancel}>
            Stop run
          </button>
        )}
      </header>

      {live && !reduced && (
        <div className="atlas-trail-pulse" aria-hidden>
          <motion.span
            initial={{ x: "-100%" }}
            animate={{ x: "420%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {state.mode === "replay" && (
        <p className="atlas-trail-disclaimer">
          This is a recorded demonstration run with invented organisations, not a live web
          search. Results are marked as demo data and carry no verified source.
        </p>
      )}

      <div className="atlas-trail-queries">
        <span className="atlas-card-index">Planned searches</span>
        <motion.ol variants={staggerContainer(0.05)} initial="hidden" animate="visible">
          <AnimatePresence initial={false}>
            {state.queries.map((query) => (
              <motion.li
                key={query.id}
                layout
                className={`atlas-trail-query-chip ${
                  state.activeQueryId === query.id ? "is-active" : ""
                } ${query.refinement ? "is-refinement" : ""}`}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring.arrive}
              >
                {query.refinement && <span className="atlas-trail-refine-tag">Refined</span>}
                <span>{query.text}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ol>
      </div>

      <LayoutGroup>
        <motion.ul layout className="atlas-source-board">
          <AnimatePresence mode="popLayout" initial={false}>
            {board.map((source, index) => (
              <SourceCard
                key={source.id}
                source={source}
                candidate={candidateFor(source.candidateId)}
                index={index}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      </LayoutGroup>

      {state.phase === "cancelled" && (
        <p className="atlas-trail-disclaimer">Run stopped. Partial findings are shown above.</p>
      )}
    </section>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "kept" | "rejected";
}) {
  return (
    <div className={`atlas-trail-tally-item ${tone ? `is-${tone}` : ""}`}>
      <dt>{label}</dt>
      <dd>
        <Counter value={value} duration={0.45} />
      </dd>
    </div>
  );
}
