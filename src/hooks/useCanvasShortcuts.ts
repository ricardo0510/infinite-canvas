import { useEffect } from "react";
import { saveSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

export function useCanvasShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return;
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
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        store.removeSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
