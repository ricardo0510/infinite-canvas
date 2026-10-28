import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";
import type { NodeKind } from "../types";

const ACTIONS: { kind: NodeKind; label: string; hint: string }[] = [
  { kind: "note", label: "Note", hint: "A card for ideas" },
  { kind: "text", label: "Text", hint: "Plain text on canvas" },
  { kind: "image", label: "Image", hint: "Upload or link" },
  { kind: "group", label: "Group", hint: "Container for nodes" },
];

export function EmptyState() {
  const isEmpty = useCanvasStore((state) => state.nodes.length === 0);
  const addNode = useCanvasStore((state) => state.addNode);
  const { screenToFlowPosition } = useReactFlow();

  if (!isEmpty) return null;

  const add = (kind: NodeKind) => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    addNode(
      kind,
      screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
      }),
    );
  };

  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>Start with a blank canvas</h2>
        <p>Double-click anywhere, right-click for more, or pick a node type below.</p>
        <div className="empty-actions">
          {ACTIONS.map((action) => (
            <button key={action.kind} type="button" className="empty-action" onClick={() => add(action.kind)}>
              <strong>{action.label}</strong>
              <span>{action.hint}</span>
            </button>
          ))}
        </div>
        <p className="empty-footnote">
          Press <kbd>?</kbd> for all shortcuts.
        </p>
      </div>
    </div>
  );
}
