import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  emptyTrail,
  isRunning,
  researchTrailReducer,
  type ResearchEvent,
  type ResearchTrailState,
} from "@/lib/researchTrail";

/**
 * A driver pushes events and resolves when the run ends. The replay driver is one
 * implementation; a live agent stream would be another, with no change to the UI.
 */
export type TrailRunner = (
  emit: (event: ResearchEvent) => void,
  signal: AbortSignal,
) => Promise<void>;

export interface ResearchTrailController {
  state: ResearchTrailState;
  running: boolean;
  start: (runner: TrailRunner) => void;
  cancel: () => void;
  reset: () => void;
}

export function useResearchTrail(): ResearchTrailController {
  const [state, dispatch] = useReducer(researchTrailReducer, emptyTrail);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const start = useCallback((runner: TrailRunner) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    void runner((event) => {
      // Ignore a superseded run so a restart never interleaves with the old one.
      if (!mounted.current || abortRef.current !== controller) return;
      dispatch(event);
    }, controller.signal).finally(() => {
      if (mounted.current && abortRef.current === controller) setRunning(false);
    });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    dispatch({ type: "trail_reset" });
  }, []);

  return { state, running: running && isRunning(state.phase), start, cancel, reset };
}
