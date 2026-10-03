import { useCallback, useRef } from "react";

/**
 * Tracks the pointer inside an element and writes it to `--mx` / `--my`, which
 * the stylesheet uses to move a soft highlight across cards. Writing straight
 * to CSS variables keeps this off the React render path.
 */
export function useSheen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const node = ref.current;
    if (!node || frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${clientX - rect.left}px`);
      node.style.setProperty("--my", `${clientY - rect.top}px`);
    });
  }, []);

  return { ref, onPointerMove };
}
