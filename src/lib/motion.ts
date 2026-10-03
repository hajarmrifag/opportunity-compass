// One shared motion vocabulary. Every animated surface composes these tokens so the
// app reads as a single authored system rather than per-component improvisation.
import type { Transition, Variants } from "motion/react";

/** Springs are named for what they feel like, not for their coefficients. */
export const spring = {
  /** Default for layout shifts and shared elements: settles without wobble. */
  settle: { type: "spring", stiffness: 420, damping: 38, mass: 0.9 },
  /** Elements entering from nothing: a little more travel, still tight. */
  arrive: { type: "spring", stiffness: 320, damping: 32, mass: 1 },
  /** Pointer-following affordances: fast, very damped, never floaty. */
  track: { type: "spring", stiffness: 520, damping: 34, mass: 0.6 },
  /** Decisive, physical moments (stamps, commits). Overshoots on purpose. */
  stamp: { type: "spring", stiffness: 700, damping: 17, mass: 0.8 },
  /** Large editorial masses: slower, heavier, cinematic. */
  editorial: { type: "spring", stiffness: 180, damping: 28, mass: 1.2 },
} satisfies Record<string, Transition>;

/** Matches the cubic-bezier already used by the original atlas CSS keyframes. */
export const ATLAS_EASE = [0.2, 0.75, 0.2, 1] as const;

export const duration = {
  quick: 0.18,
  base: 0.32,
  slow: 0.56,
  /** Beat between stamped decisions — long enough to read, short enough to stay tense. */
  beat: 0.42,
} as const;

/** Standard rise-and-fade, the motion equivalent of the original `atlas-settle`. */
export const settleVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
} satisfies Variants;

/**
 * Stagger container. `each` is per-child delay; unlike the old nth-child CSS the
 * delay keeps accumulating past five items, so long lists still cascade.
 */
export function staggerContainer(each = 0.045, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: each, delayChildren } },
  };
}

/** Viewport config shared by scroll-reveal sections so thresholds stay consistent. */
export const revealViewport = { once: true, amount: 0.25 } as const;
