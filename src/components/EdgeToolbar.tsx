import { MarkerType } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { NOTE_COLORS, DEFAULT_EDGE_STROKE } from "../lib/theme";
import { useCanvasStore } from "../store/canvasStore";
import type { NoteColor } from "../types";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Input } from "./ui/Control";

const DEFAULT_STROKE = DEFAULT_EDGE_STROKE;

const COLOR_LABELS: Record<NoteColor, string> = {
  violet: "灰蓝",
  cyan: "青灰",
  amber: "赭黄",
  emerald: "苔绿",
};

const COLORS: { label: string; value: string }[] = [
  { label: "默认", value: DEFAULT_STROKE },
  ...(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => ({
    label: COLOR_LABELS[color],
    value: NOTE_COLORS[color],
  })),
];

const DASHES: { label: string; value: string | undefined; className: string }[] = [
  { label: "实线", value: undefined, className: "dash-preview" },
  { label: "虚线", value: "6 4", className: "dash-preview dash-preview--dashed" },
  { label: "点线", value: "2 4", className: "dash-preview dash-preview--dotted" },
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
    <div className="selection-toolbar edge-toolbar" role="toolbar" aria-label="连线样式">
      <Input
        controlSize="sm"
        className="edge-label-input"
        value={typeof edge.label === "string" ? edge.label : ""}
        placeholder="连线标签"
        aria-label="连线标签"
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
        <Button
          key={color.value}
          variant="ghost"
          size="sm"
          icon
          className={`edge-color-button${stroke === color.value ? " is-active" : ""}`}
          title={`连线颜色：${color.label}`}
          aria-label={`连线颜色：${color.label}`}
          onClick={() => setColor(color.value)}
        >
          <span className="edge-color-dot" style={{ background: color.value }} />
        </Button>
      ))}
      <span className="selection-divider" />
      {DASHES.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="sm"
          icon
          className={dash === item.value ? "is-active" : undefined}
          title={`线条样式：${item.label}`}
          aria-label={`线条样式：${item.label}`}
          onClick={() => setStyle({ strokeDasharray: item.value })}
        >
          <span className={item.className} />
        </Button>
      ))}
      <span className="selection-divider" />
      <Button
        variant="ghost"
        size="sm"
        icon
        className={hasArrow ? "is-active" : undefined}
        title={hasArrow ? "移除箭头" : "添加箭头"}
        aria-label={hasArrow ? "移除箭头" : "添加箭头"}
        onClick={toggleArrow}
      >
        <Icon name="arrow-right" size={15} />
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon
        title="删除连线"
        aria-label="删除连线"
        onClick={() => removeEdge(edge.id)}
      >
        <Icon name="trash" size={15} />
      </Button>
    </div>
  );
}
