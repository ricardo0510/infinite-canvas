import { MarkerType } from "@xyflow/react";
import type { CanvasEdge, CanvasNode, CanvasSnapshot, NoteColor } from "../types";
import { SCHEMA_VERSION } from "./storage";

const COLORS: NoteColor[] = ["violet", "cyan", "amber", "emerald"];

/**
 * Deterministic synthetic canvas used by `npm run bench`.
 * The node count is clamped to a range that still makes sense in a browser tab.
 */
export function buildStressSnapshot(count: number): CanvasSnapshot {
  const total = Math.max(1, Math.min(3000, Math.floor(count)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(total * 1.4)));
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  for (let index = 0; index < total; index++) {
    const id = `stress-node-${index}`;
    nodes.push({
      id,
      type: "note",
      position: {
        x: (index % columns) * 300,
        y: Math.floor(index / columns) * 240,
      },
      width: 260,
      height: 190,
      style: { width: 260, height: 190 },
      data: {
        title: `Node ${index + 1}`,
        body: "",
        color: COLORS[index % COLORS.length],
      },
    });

    if (index > 0) {
      edges.push({
        id: `stress-edge-${index}`,
        source: `stress-node-${index - 1}`,
        target: id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: "#5b6478", strokeWidth: 1.5 },
      });
    }
  }

  return { version: SCHEMA_VERSION, nodes, edges };
}
