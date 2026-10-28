import dagre from "@dagrejs/dagre";
import { nodeSize } from "./geometry";
import type { CanvasEdge, CanvasNode } from "../types";

type LayoutOptions = {
  direction?: "LR" | "TB";
};

/**
 * Lays out top-level nodes with Dagre. Children stay inside their group
 * because their positions are relative to the parent.
 */
export function layoutNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  options: LayoutOptions = {},
): CanvasNode[] {
  const topLevel = nodes.filter((node) => !node.parentId);
  if (topLevel.length === 0) return nodes;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: options.direction ?? "LR",
    nodesep: 64,
    ranksep: 120,
    marginx: 32,
    marginy: 32,
  });

  const ids = new Set(topLevel.map((node) => node.id));
  for (const node of topLevel) {
    const { width, height } = nodeSize(node);
    graph.setNode(node.id, { width, height });
  }
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    if (node.parentId) return node;
    const laidOut = graph.node(node.id) as { x: number; y: number } | undefined;
    if (!laidOut) return node;
    const { width, height } = nodeSize(node);
    return {
      ...node,
      position: { x: laidOut.x - width / 2, y: laidOut.y - height / 2 },
    };
  });
}
