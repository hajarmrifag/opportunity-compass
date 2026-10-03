import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ATLAS_EASE } from "@/lib/motion";

export function MagneticLine({
  text,
  delay = 0,
  italic = false,
}: {
  text: string;
  delay?: number;
  italic?: boolean;
}) {
  const reduced = useReducedMotion();
  const row = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const root = row.current;
    if (!root) return;
    const letters = [...root.querySelectorAll<HTMLElement>("[data-letter]")];
    let frame = 0;
    let px = -9999;
    let py = -9999;
    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
    };
    const tick = () => {
      for (const letter of letters) {
        const box = letter.getBoundingClientRect();
        const dx = px - (box.left + box.width / 2);
        const dy = py - (box.top + box.height / 2);
        const dist = Math.hypot(dx, dy);
        const radius = 150;
        if (dist < radius) {
          const pull = (1 - dist / radius) ** 2;
          letter.style.transform = `translate3d(${dx * pull * 0.28}px, ${dy * pull * 0.28}px, 0)`;
        } else if (letter.style.transform) {
          letter.style.transform = "translate3d(0,0,0)";
        }
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <span className={`atlas-hero-line ${italic ? "is-italic" : ""}`}>
      <motion.span
        ref={row}
        className="atlas-magnetic-row"
        initial={reduced ? { opacity: 0 } : { y: "110%" }}
        animate={reduced ? { opacity: 1 } : { y: "0%" }}
        transition={reduced ? { duration: 0.2 } : { duration: 0.95, ease: ATLAS_EASE, delay }}
      >
        {text.split("").map((char, index) =>
          char === " " ? (
            <span key={`sp-${index}`}>{"\u00A0"}</span>
          ) : (
            <span key={`${char}-${index}`} data-letter="">{char}</span>
          ),
        )}
      </motion.span>
    </span>
  );
}