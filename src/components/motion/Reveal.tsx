import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ATLAS_EASE, revealViewport, spring } from "@/lib/motion";

/**
 * A line of display type that rises out of its own mask. Used for headlines,
 * where the clip is the point: the words arrive rather than fade in.
 */
export function MaskedLine({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className={`atlas-hero-line ${className ?? ""}`}>
      <motion.span
        className="block"
        initial={reduced ? { opacity: 0 } : { y: "110%" }}
        animate={reduced ? { opacity: 1 } : { y: "0%" }}
        transition={
          reduced ? { duration: 0.2 } : { duration: 0.9, ease: ATLAS_EASE, delay }
        }
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Scroll-triggered settle, the workhorse reveal for sections down the page. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={revealViewport}
      transition={reduced ? { duration: 0.2 } : { ...spring.arrive, delay }}
    >
      {children}
    </Component>
  );
}
