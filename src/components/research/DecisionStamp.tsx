import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * The decisive beat of the Evidence Trail: a candidate is kept or rejected.
 * Reads as a rubber stamp hitting paper — oversized, rotated, overshooting once.
 */
export function DecisionStamp({ keep, label }: { keep: boolean; label: string }) {
  const reduced = useReducedMotion();
  const tone = keep ? "is-kept" : "is-rejected";

  if (reduced) {
    return (
      <span className={`atlas-stamp ${tone} w-[5.6rem] text-center`} aria-hidden>
        {label}
      </span>
    );
  }

  return (
    <span className="atlas-stamp-slot w-[5.6rem]" aria-hidden>
      <motion.span
        className={`atlas-stamp-ring ${tone}`}
        initial={{ scale: 0.4, opacity: 0.55 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.span
        className={`atlas-stamp ${tone} w-[5.6rem] text-center`}
        initial={{ scale: 2.7, opacity: 0, rotate: -26 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={spring.stamp}
      >
        {label}
      </motion.span>
    </span>
  );
}
