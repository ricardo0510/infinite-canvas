import { useEffect } from "react";
import { exportSnapshot, saveSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

export function useCanvasShortcuts(): void {
  // Capture arrows before React Flow's focused-node handler so nudging keeps
  // the 1px / 10px contract instead of moving by its default step.
  useEffect(() => {
    const onArrowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditable(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
      const store = useCanvasStore.getState();
      if (!store.nodes.some((node) => node.selected)) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 10 : 1;
      const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
      const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
      store.nudgeSelected(dx, dy);
    };
    window.addEventListener("keydown", onArrowKeyDown, true);
    return () => window.removeEventListener("keydown", onArrowKeyDown, true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditable(event.target)) return;
      const store = useCanvasStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (mod && key === "c") {
        event.preventDefault();
        store.copySelected();
        return;
      }
      if (mod && key === "v") {
        event.preventDefault();
        store.paste();
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        saveSnapshot(store.getSnapshot());
        return;
      }
      if (mod && key === "a") {
        event.preventDefault();
        store.selectAll();
        return;
      }
      if (mod && key === "e") {
        event.preventDefault();
        exportSnapshot(store.getSnapshot());
        return;
      }
      if (mod && key === "g") {
        event.preventDefault();
        if (event.shiftKey) store.ungroupSelected();
        else store.groupSelected();
        return;
      }
      if (mod && key === "l") {
        event.preventDefault();
        void store.autoLayout();
        return;
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        store.removeSelected();
        return;
      }
      if (key === "escape") {
        store.clearSelection();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
