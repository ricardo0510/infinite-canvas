import { useViewport } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";

export function StatusBar() {
  const nodeCount = useCanvasStore((state) => state.nodes.length);
  const edgeCount = useCanvasStore((state) => state.edges.length);
  const { zoom } = useViewport();

  return (
    <div className="statusbar" role="status">
      <span>{nodeCount} {nodeCount === 1 ? "node" : "nodes"}</span>
      <span className="statusbar-sep">·</span>
      <span>{edgeCount} {edgeCount === 1 ? "edge" : "edges"}</span>
      <span className="statusbar-sep">·</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span className="statusbar-hint">Double-click to add · drag handles to connect</span>
    </div>
  );
}
