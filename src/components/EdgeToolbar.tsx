import { MarkerType } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { NOTE_COLORS, useCanvasStore } from "../store/canvasStore";
import type { NoteColor } from "../types";

const DEFAULT_STROKE = "#5b6478";

const COLORS: { label: string; value: string }[] = [
  { label: "Default", value: DEFAULT_STROKE },
  ...(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => ({
    label: color,
    value: NOTE_COLORS[color],
  })),
];

const DASHES: { label: string; value: string | undefined; glyph: string }[] = [
  { label: "Solid", value: undefined, glyph: "—" },
  { label: "Dashed", value: "6 4", glyph: "╌" },
  { label: "Dotted", value: "2 4", glyph: "┈" },
];

export function EdgeToolbar() {
  const edge = useCanvasStore((state) => {
    const selected = state.edges.filter((item) => item.selected);
    return selected.length === 1 ? selected[0] : null;
  });
  const hasSelectedNode = useCanvasStore((state) => state.nodes.some((node) => node.selected));
  const updateEdge = useCanvasStore((state) => state.updateEdge);
  const removeEdge = useCanvasStore((state) => state.removeEdge);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);

  useEffect(() => {
    editing.current = false;
  }, [edge?.id]);

  if (!edge || hasSelectedNode) return null;

  const stroke = (edge.style?.stroke as string | undefined) ?? DEFAULT_STROKE;
  const dash = edge.style?.strokeDasharray as string | undefined;
  const hasArrow = Boolean(edge.markerEnd);

  const handleLabel = (value: string) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateEdge(edge.id, { label: value });
  };

  const setStyle = (patch: { stroke?: string; strokeDasharray?: string }) => {
    commit();
    updateEdge(edge.id, { style: { ...edge.style, ...patch } });
  };

  const setColor = (value: string) => {
    commit();
    const markerEnd =
      edge.markerEnd && typeof edge.markerEnd === "object"
        ? { ...edge.markerEnd, color: value }
        : edge.markerEnd;
    updateEdge(edge.id, { style: { ...edge.style, stroke: value }, markerEnd });
  };

  const toggleArrow = () => {
    commit();
    updateEdge(edge.id, {
      markerEnd: hasArrow
        ? undefined
        : { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
    });
  };

  return (
    <div className="selection-toolbar edge-toolbar" role="toolbar" aria-label="Edge style">
      <input
        className="edge-label-input"
        value={typeof edge.label === "string" ? edge.label : ""}
        placeholder="Edge label"
        aria-label="Edge label"
        maxLength={80}
        onFocus={() => {
          editing.current = false;
        }}
        onChange={(event) => handleLabel(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <span className="selection-divider" />
      {COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={`selection-button edge-color-button${stroke === color.value ? " is-active" : ""}`}
          title={`Edge color: ${color.label}`}
          aria-label={`Edge color: ${color.label}`}
          onClick={() => setColor(color.value)}
        >
          <span className="edge-color-dot" style={{ background: color.value }} />
        </button>
      ))}
      <span className="selection-divider" />
      {DASHES.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`selection-button${dash === item.value ? " is-active" : ""}`}
          title={`Line style: ${item.label}`}
          aria-label={`Line style: ${item.label}`}
          onClick={() => setStyle({ strokeDasharray: item.value })}
        >
          {item.glyph}
        </button>
      ))}
      <span className="selection-divider" />
      <button
        type="button"
        className={`selection-button${hasArrow ? " is-active" : ""}`}
        title={hasArrow ? "Remove arrow" : "Add arrow"}
        aria-label={hasArrow ? "Remove arrow" : "Add arrow"}
        onClick={toggleArrow}
      >
        →
      </button>
      <button
        type="button"
        className="selection-button selection-danger"
        title="Delete edge"
        aria-label="Delete edge"
        onClick={() => removeEdge(edge.id)}
      >
        ✕
      </button>
    </div>
  );
}
