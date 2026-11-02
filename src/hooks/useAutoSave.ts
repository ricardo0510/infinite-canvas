import { useEffect } from "react";
import { saveSnapshot, SCHEMA_VERSION } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

/** Debounced local-first autosave. */
export function useAutoSave(): void {
  useEffect(() => {
    // Benchmark mode replaces the canvas in memory and must not overwrite local data.
    if (new URLSearchParams(window.location.search).has("bench")) return;
    let timer: number | undefined;

    const persist = () => {
      const state = useCanvasStore.getState();
      saveSnapshot({
        version: SCHEMA_VERSION,
        nodes: state.nodes,
        edges: state.edges,
        ...(state.viewport ? { viewport: state.viewport } : {}),
      });
    };

    // 关闭标签页时防抖可能还没触发，先把最后一次修改落盘。
    const flush = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      persist();
    };

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
        timer = undefined;
        persist();
      }, 400);
    });

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      unsubscribe();
    };
  }, []);
}
