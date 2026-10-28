import { useEffect } from "react";
import { saveSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

/** Debounced local-first autosave. */
export function useAutoSave(): void {
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.nodes === previous.nodes && state.edges === previous.edges) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveSnapshot({ nodes: state.nodes, edges: state.edges });
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
