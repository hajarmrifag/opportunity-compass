import { motion, useReducedMotion } from "motion/react";
import { DecisionStamp } from "@/components/research/DecisionStamp";
import { spring } from "@/lib/motion";

/**
 * A scroll-triggered miniature of what the Research screen actually does:
 * pages come in, evidence is quoted, each page is kept or rejected.
 * Hosts use the reserved .example TLD so nothing here can read as a real site.
 */
const PAGES = [
  {
    host: "fellowships.greenhorizon-trust.example",
    quote: "Applicants must be enrolled in a master’s programme.",
    keep: true,
  },
  {
    host: "top-20-grants-roundup.example",
    quote: "No eligibility or deadline stated on the page.",
    keep: false,
  },
  {
    host: "northwind-institute.example",
    quote: "The stipend covers travel and living costs for 12 weeks.",
    keep: true,
  },
  {
    host: "scholarship-aggregator.example",
    quote: "Deadline listed as “varies” with no source link.",
    keep: false,
  },
  {
    host: "tidewater-field.example",
    quote: "Applications close 30 November 2026 at 17:00 UTC.",
    keep: true,
  },
] as const;

export function EvidenceModel() {
  const reduced = useReducedMotion();

  return (
    <ol className="atlas-evidence-model">
      {PAGES.map((page, index) => (
        <motion.li
          key={page.host}
          className={page.keep ? "is-kept" : "is-rejected"}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 48 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ ...spring.arrive, delay: index * 0.14 }}
        >
          <span className="atlas-evidence-host">{page.host}</span>
          <p>“{page.quote}”</p>
          <motion.span
            className="atlas-evidence-verdict"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: index * 0.14 + 0.42 }}
          >
            <DecisionStamp keep={page.keep} label={page.keep ? "Kept" : "Rejected"} />
          </motion.span>
        </motion.li>
      ))}
    </ol>
  );
}
