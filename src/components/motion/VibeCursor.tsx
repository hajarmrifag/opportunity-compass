import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * A lagged lime orb that follows the pointer. Desktop + motion only —
 * touch devices and reduced-motion keep the native cursor.
 */
export function VibeCursor() {
  const reduced = useReducedMotion();
  const orb = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const a = orb.current;
    const b = glow.current;
    if (!a || !b) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      tx = event.clientX;
      ty = event.clientY;
      const target = event.target;
      const hot =
        target instanceof Element &&
        Boolean(target.closest("a, button, input, [role='button']"));
      a.classList.toggle("is-hot", hot);
      b.classList.toggle("is-hot", hot);
    };

    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      a.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const gx = x + (tx - x) * 0.35;
      const gy = y + (ty - y) * 0.35;
      b.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div className="atlas-vibe" aria-hidden>
      <div ref={glow} className="atlas-vibe-glow" />
      <div ref={orb} className="atlas-vibe-orb" />
    </div>
  );
}
