export const ATLAS_EASE = [0.22, 1, 0.36, 1] as const;
export const spring = {
  arrive: { type: "spring", stiffness: 120, damping: 24 },
  settle: { type: "spring", stiffness: 180, damping: 30 },
  stamp: { type: "spring", stiffness: 700, damping: 17, mass: 0.8 },
} as const;
export const revealViewport = { once: true, amount: 0.2 } as const;
export const duration = { quick: 0.18, base: 0.32, slow: 0.56, beat: 0.42 } as const;
export function staggerContainer(each = 0.045, delayChildren = 0) {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: each, delayChildren } },
  };
}