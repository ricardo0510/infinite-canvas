import { useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { exportSnapshot, parseSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const addNote = useCanvasStore((state) => state.addNote);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const clear = useCanvasStore((state) => state.clear);
  const importSnapshot = useCanvasStore((state) => state.importSnapshot);
  const getSnapshot = useCanvasStore((state) => state.getSnapshot);
  const canUndo = useCanvasStore((state) => state.past.length > 0);
  const canRedo = useCanvasStore((state) => state.future.length > 0);

  const handleAdd = () => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    const position = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
    });
    addNote(position);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const snapshot = parseSnapshot(JSON.parse(await file.text()));
      if (!snapshot) {
        window.alert("This JSON does not look like a canvas snapshot.");
        return;
      }
      importSnapshot(snapshot);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
    } catch {
      window.alert("Could not read that file as JSON.");
    }
  };

  const handleClear = () => {
    if (useCanvasStore.getState().nodes.length === 0) return;
    if (window.confirm("Clear the canvas? This can be undone with Ctrl/Cmd + Z.")) clear();
  };

  return (
    <div className="toolbar">
      <button type="button" className="tool-button tool-primary" onClick={handleAdd} title="Add a note (double-click the canvas)">
        <span aria-hidden="true">+</span>
        <span className="tool-label">Note</span>
      </button>
      <button type="button" className="tool-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd + Z)">
        <span aria-hidden="true">↶</span>
        <span className="tool-label">Undo</span>
      </button>
      <button type="button" className="tool-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd + Shift + Z)">
        <span aria-hidden="true">↷</span>
        <span className="tool-label">Redo</span>
      </button>
      <button type="button" className="tool-button" onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 })} title="Fit view">
        <span aria-hidden="true">⌖</span>
        <span className="tool-label">Fit</span>
      </button>
      <button type="button" className="tool-button" onClick={() => exportSnapshot(getSnapshot())} title="Export JSON">
        <span aria-hidden="true">↓</span>
        <span className="tool-label">Export</span>
      </button>
      <button type="button" className="tool-button" onClick={() => fileInput.current?.click()} title="Import JSON">
        <span aria-hidden="true">↑</span>
        <span className="tool-label">Import</span>
      </button>
      <button type="button" className="tool-button tool-danger" onClick={handleClear} title="Clear canvas">
        <span aria-hidden="true">×</span>
        <span className="tool-label">Clear</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={handleImport}
      />
    </div>
  );
}
