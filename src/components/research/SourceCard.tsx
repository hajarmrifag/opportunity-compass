import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { TrailCandidateState, TrailEvidence, TrailSourceState } from "@/lib/researchTrail";
import { duration, spring } from "@/lib/motion";
import { DecisionStamp } from "./DecisionStamp";

const STATUS_COPY: Record<TrailSourceState["status"], string> = {
  found: "Queued",
  fetching: "Fetching",
  read: "Read",
  extracting: "Extracting",
  extracted: "Candidate",
  failed: "Discarded",
  kept: "Kept",
  rejected: "Rejected",
};

/** A page the agent retrieved, with every fact it pulled out of that page. */
export function SourceCard({
  source,
  candidate,
  index,
}: {
  source: TrailSourceState;
  candidate: TrailCandidateState | null;
  index: number;
}) {
  const reduced = useReducedMotion();
  const decided = candidate?.decision ?? null;
  const busy = source.status === "fetching" || source.status === "extracting";

  return (
    <motion.li
      layout
      className={`atlas-source-card is-${source.status}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduced
          ? { opacity: 0 }
          : // Rejected pages are physically swept off the board.
            { opacity: 0, x: -42, rotate: -3, scale: 0.94, transition: { duration: duration.base } }
      }
      transition={spring.arrive}
    >
      <div className="atlas-source-head">
        <span className="atlas-source-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="atlas-source-url" title={`${source.host}${source.path}`}>
          <span className="atlas-source-host">{source.host}</span>
          <span className="atlas-source-path">{source.path}</span>
        </span>
        <span className={`atlas-source-status is-${source.status}`}>
          {STATUS_COPY[source.status]}
        </span>
      </div>

      <p className="atlas-source-title">{source.title}</p>

      {busy && !reduced && (
        <div className="atlas-source-scan" aria-hidden>
          <motion.span
            initial={{ x: "-100%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        {source.evidence.length > 0 && (
          <motion.ul layout className="atlas-evidence-list" key="evidence">
            {source.evidence.map((item) => (
              <EvidenceRow key={item.id} evidence={item} reduced={!!reduced} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {source.failureReason && (
        <motion.p
          className="atlas-source-failure"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base }}
        >
          {source.failureReason}
        </motion.p>
      )}

      {candidate && (
        <motion.div layout className="atlas-source-candidate">
          <div className="min-w-0">
            <span className="atlas-card-index">Candidate</span>
            <strong>{candidate.title}</strong>
            <span>{candidate.organization}</span>
          </div>
          <AnimatePresence>
            {decided && (
              <DecisionStamp key="stamp" keep={decided.keep} label={decided.keep ? "Kept" : "Cut"} />
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {decided && (
        <motion.p
          className="atlas-source-reason"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.22, duration: duration.base }}
        >
          <span className="atlas-card-index">{decided.by === "rules" ? "Rules" : "AI review"}</span>{" "}
          {decided.reason}
        </motion.p>
      )}
    </motion.li>
  );
}

/**
 * One extracted fact, shown as the verbatim page sentence with the matched span
 * lit up. The highlight wipes in so you can see *which words* produced the fact.
 */
function EvidenceRow({ evidence, reduced }: { evidence: TrailEvidence; reduced: boolean }) {
  const before = evidence.sentence.slice(0, evidence.matchStart);
  const match = evidence.sentence.slice(evidence.matchStart, evidence.matchEnd);
  const after = evidence.sentence.slice(evidence.matchEnd);

  return (
    <motion.li
      layout
      className="atlas-evidence-item"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.arrive}
    >
      <div className="atlas-evidence-fact">
        <span className="atlas-evidence-field">{evidence.field}</span>
        <strong>{evidence.value}</strong>
      </div>
      <p className="atlas-evidence-sentence">
        {before}
        <span className="atlas-evidence-mark">
          {!reduced && (
            <motion.span
              className="atlas-evidence-wipe"
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.42, ease: [0.2, 0.75, 0.2, 1], delay: 0.1 }}
            />
          )}
          <span className="atlas-evidence-text">{match}</span>
        </span>
        {after}
      </p>
    </motion.li>
  );
}
