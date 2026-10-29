import type { XYPosition } from "@xyflow/react";
import type { CanvasNode, NodeKind } from "../types";

export const AI_NODE_WIDTH = 280;
export const NODE_HEADER_HEIGHT = 34;
export const EMPTY_NODE_HEIGHT = 160;

export const MIN_SIZE: Record<NodeKind, { width: number; height: number }> = {
  text: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  image: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  video: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  group: { width: 220, height: 140 },
};

export const DEFAULT_SIZE: Record<NodeKind, { width: number; height: number }> = {
  text: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  image: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  video: { width: AI_NODE_WIDTH, height: EMPTY_NODE_HEIGHT },
  group: { width: 320, height: 200 },
};

export function mediaNodeHeight(width: number, contentWidth: number, contentHeight: number): number {
  if (!(contentWidth > 0) || !(contentHeight > 0)) return EMPTY_NODE_HEIGHT;
  const bodyHeight = (width * contentHeight) / contentWidth;
  return Math.round(NODE_HEADER_HEIGHT + bodyHeight);
}

export const GRID_SIZE = 8;

export type NodeRect = { x: number; y: number; width: number; height: number };

function styleSize(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function nodeSize(node: CanvasNode): { width: number; height: number } {
  const type: NodeKind = (node.type as NodeKind) ?? "text";
  const fallback = DEFAULT_SIZE[type] ?? DEFAULT_SIZE.text;
  return {
    width: node.width ?? node.measured?.width ?? styleSize(node.style?.width) ?? fallback.width,
    height: node.height ?? node.measured?.height ?? styleSize(node.style?.height) ?? fallback.height,
  };
}

export function byId(nodes: CanvasNode[]): Map<string, CanvasNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function absolutePosition(node: CanvasNode, index: Map<string, CanvasNode>): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  const seen = new Set<string>([node.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = index.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function nodeRect(node: CanvasNode, index: Map<string, CanvasNode>): NodeRect {
  const { width, height } = nodeSize(node);
  const position = absolutePosition(node, index);
  return { x: position.x, y: position.y, width, height };
}

export function boundsOfRects(rects: NodeRect[]): NodeRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function boundsOf(nodes: CanvasNode[]): NodeRect | null {
  if (nodes.length === 0) return null;
  const index = byId(nodes);
  return boundsOfRects(nodes.map((node) => nodeRect(node, index)));
}

export function hasAncestor(
  node: CanvasNode,
  ancestorId: string,
  index: Map<string, CanvasNode>,
): boolean {
  let parentId = node.parentId;
  const seen = new Set<string>([node.id]);
  while (parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) return true;
    seen.add(parentId);
    parentId = index.get(parentId)?.parentId;
  }
  return false;
}

export function descendantIds(ids: Iterable<string>, nodes: CanvasNode[]): Set<string> {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function snapValue(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

export function clampSize(kind: NodeKind, width: number, height: number): { width: number; height: number } {
  const min = MIN_SIZE[kind] ?? MIN_SIZE.text;
  return { width: Math.max(min.width, width), height: Math.max(min.height, height) };
}
