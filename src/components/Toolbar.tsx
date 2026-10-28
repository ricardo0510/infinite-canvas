import { useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { exportSnapshot, parseSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";
import { useUiStore } from "../store/uiStore";
import type { NodeKind } from "../types";

const ADD_ITEMS: { kind: NodeKind; label: string; glyph: string; title: string }[] = [
  { kind: "note", label: "Note", glyph: "+", title: "Add a note" },
  { kind: "text", label: "Text", glyph: "T", title: "Add text" },
  { kind: "image", label: "Image", glyph: "▣", title: "Add an image" },
  { kind: "group", label: "Group", glyph: "▢", title: "Add a group" },
];

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const { fitView, screenToFlowPosition, setViewport } = useReactFlow();
  const addNode = useCanvasStore((state) => state.addNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const clear = useCanvasStore((state) => state.clear);
  const importSnapshot = useCanvasStore((state) => state.importSnapshot);
  const getSnapshot = useCanvasStore((state) => state.getSnapshot);
  const autoLayout = useCanvasStore((state) => state.autoLayout);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const toggleSnap = useUiStore((state) => state.toggleSnap);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const pushToast = useToastStore((state) => state.push);
  const canUndo = useCanvasStore((state) => state.past.length > 0);
  const canRedo = useCanvasStore((state) => state.future.length > 0);
  const hasNodes = useCanvasStore((state) => state.nodes.length > 0);

  const centerPosition = () => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
    });
  };

  const handleAdd = (kind: NodeKind) => {
    addNode(kind, centerPosition());
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const snapshot = parseSnapshot(JSON.parse(await file.text()));
      if (!snapshot) {
        pushToast("This JSON does not look like a canvas snapshot.", "error");
        return;
      }
      importSnapshot(snapshot);
      window.setTimeout(() => {
        if (snapshot.viewport) setViewport(snapshot.viewport);
        else fitView({ padding: 0.2, duration: 300 });
      }, 0);
      pushToast("Canvas imported.", "success");
    } catch {
      pushToast("Could not read that file as JSON.", "error");
    }
  };

  const handleClear = () => {
    if (!hasNodes) return;
    if (window.confirm("Clear the canvas? This can be undone with Ctrl/Cmd + Z.")) clear();
  };

  const handleLayout = () => {
    void autoLayout().then(() => {
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
    });
  };

  return (
    <div className="toolbar">
      <div className="tool-cluster">
        {ADD_ITEMS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`tool-button${item.kind === "note" ? " tool-primary" : ""}`}
            onClick={() => handleAdd(item.kind)}
            title={item.title}
          >
            <span aria-hidden="true">{item.glyph}</span>
            <span className="tool-label">{item.label}</span>
          </button>
        ))}
      </div>
      <span className="tool-divider" />
      <button type="button" className="tool-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd + Z)">
        <span aria-hidden="true">↶</span>
        <span className="tool-label">Undo</span>
      </button>
      <button type="button" className="tool-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd + Shift + Z)">
        <span aria-hidden="true">↷</span>
        <span className="tool-label">Redo</span>
      </button>
      <span className="tool-divider" />
      <button type="button" className="tool-button" onClick={handleLayout} disabled={!hasNodes} title="Auto layout (Ctrl/Cmd + L)">
        <span aria-hidden="true">⤢</span>
        <span className="tool-label">Layout</span>
      </button>
      <button
        type="button"
        className={`tool-button${snapToGrid ? " is-on" : ""}`}
        onClick={toggleSnap}
        aria-pressed={snapToGrid}
        title={`Snap to grid: ${snapToGrid ? "on" : "off"}`}
      >
        <span aria-hidden="true">⌗</span>
        <span className="tool-label">Snap</span>
      </button>
      <button
        type="button"
        className="tool-button"
        onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 })}
        title="Fit view"
      >
        <span aria-hidden="true">⛶</span>
        <span className="tool-label">Fit</span>
      </button>
      <span className="tool-divider" />
      <button type="button" className="tool-button" onClick={() => exportSnapshot(getSnapshot())} title="Export JSON">
        <span aria-hidden="true">↓</span>
        <span className="tool-label">Export</span>
      </button>
      <button type="button" className="tool-button" onClick={() => fileInput.current?.click()} title="Import JSON">
        <span aria-hidden="true">↑</span>
        <span className="tool-label">Import</span>
      </button>
      <button type="button" className="tool-button" onClick={() => setCommandOpen(true)} title="Command palette (/)">
        <span aria-hidden="true">/</span>
        <span className="tool-label">Commands</span>
      </button>
      <button type="button" className="tool-button" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
        <span aria-hidden="true">?</span>
        <span className="tool-label">Shortcuts</span>
      </button>
      <button type="button" className="tool-button tool-danger" onClick={handleClear} disabled={!hasNodes} title="Clear canvas">
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
