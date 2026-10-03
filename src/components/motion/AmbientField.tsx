import { useReducedMotion } from "motion/react";

export function AmbientField() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="atlas-field" aria-hidden="true">
      <canvas className="atlas-canvas" />
    </div>
  );
}