import { useEffect } from "react";
import { saveSnapshot, SCHEMA_VERSION } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

/** Debounced local-first autosave. */
export function useAutoSave(): void {
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (
        state.nodes === previous.nodes &&
        state.edges === previous.edges &&
        state.viewport === previous.viewport
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveSnapshot({
          version: SCHEMA_VERSION,
          nodes: state.nodes,
          edges: state.edges,
          ...(state.viewport ? { viewport: state.viewport } : {}),
        });
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
