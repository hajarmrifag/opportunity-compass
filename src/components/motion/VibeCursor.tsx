import { useReducedMotion } from "motion/react";

export function VibeCursor() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="atlas-vibe" aria-hidden="true">
      <div className="atlas-vibe-glow" />
      <div className="atlas-vibe-orb" />
    </div>
  );
}