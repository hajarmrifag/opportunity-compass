import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * Counts up to `value` whenever it changes. Used for the trail tally and the
 * dashboard stats so numbers arrive rather than simply appear.
 */
export function Counter({
  value,
  /** Wait until scrolled into view before the first count. */
  onView = false,
  duration = 0.9,
  className,
}: {
  value: number;
  onView?: boolean;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [shown, setShown] = useState(reduced || !onView ? value : 0);
  const from = useRef(shown);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    if (onView && !inView) return;
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.75, 0.2, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => controls.stop();
  }, [value, inView, onView, reduced, duration]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
