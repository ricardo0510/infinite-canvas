import type { NodeChange } from "@xyflow/react";
import { boundsOfRects, byId, hasAncestor, nodeRect, type NodeRect } from "./geometry";
import type { CanvasNode } from "../types";

export type Guide = {
  orientation: "vertical" | "horizontal";
  position: number;
  start: number;
  end: number;
};

/** Snap distance in screen pixels, converted to flow units by the current zoom. */
const SNAP_THRESHOLD_PX = 6;
/** Alignment tolerance in screen pixels (absorbs float error after snapping). */
const ALIGN_EPSILON_PX = 0.5;
/** How far a guide extends past the two nodes it connects. */
const GUIDE_OVERFLOW_PX = 18;

const xAnchors = (rect: NodeRect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
const yAnchors = (rect: NodeRect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

function hasMovingAncestor(
  node: CanvasNode,
  movingIds: Set<string>,
  index: Map<string, CanvasNode>,
): boolean {
  for (const id of movingIds) {
    if (hasAncestor(node, id, index)) return true;
  }
  return false;
}

function isMovingAncestor(
  node: CanvasNode,
  movingIds: Set<string>,
  index: Map<string, CanvasNode>,
): boolean {
  for (const id of movingIds) {
    const moving = index.get(id);
    if (moving && hasAncestor(moving, node.id, index)) return true;
  }
  return false;
}

function isAlignCandidate(
  node: CanvasNode,
  movingIds: Set<string>,
  index: Map<string, CanvasNode>,
): boolean {
  if (movingIds.has(node.id)) return false;
  // Groups are containers; snapping a child to its own container edge feels random.
  if (node.type === "group") return false;
  if (isMovingAncestor(node, movingIds, index)) return false;
  return !hasMovingAncestor(node, movingIds, index);
}

/**
 * Snaps the position changes of the nodes currently being dragged to the
 * left/center/right and top/middle/bottom anchors of the other nodes.
 * Returns the original changes untouched when nothing is within range.
 */
export function snapDragChanges(
  changes: NodeChange<CanvasNode>[],
  nodes: CanvasNode[],
  zoom: number,
): NodeChange<CanvasNode>[] {
  const index = byId(nodes);
  const movingIds = new Set<string>();

  for (const change of changes) {
    if (change.type !== "position" || !change.position) continue;
    const node = index.get(change.id);
    if (change.dragging === true || node?.dragging === true) movingIds.add(change.id);
  }
  if (movingIds.size === 0) return changes;

  // Dragging a container moves its children through React Flow; snapping the
  // container would need a different anchor model, so leave groups alone.
  for (const id of movingIds) {
    if (index.get(id)?.type === "group") return changes;
  }

  // Use the positions from the changes (not the previous store state).
  const positionIndex = new Map(index);
  for (const change of changes) {
    if (change.type !== "position" || !change.position) continue;
    const node = positionIndex.get(change.id);
    if (node) positionIndex.set(change.id, { ...node, position: change.position });
  }

  const movingNodes = [...movingIds]
    .map((id) => positionIndex.get(id))
    .filter((node): node is CanvasNode => Boolean(node));
  const movingBounds = boundsOfRects(movingNodes.map((node) => nodeRect(node, positionIndex)));
  if (!movingBounds) return changes;

  const threshold = SNAP_THRESHOLD_PX / Math.max(zoom, 0.01);
  const selfX = xAnchors(movingBounds);
  const selfY = yAnchors(movingBounds);
  const candidates = nodes
    .filter((node) => isAlignCandidate(node, movingIds, index))
    .map((node) => nodeRect(node, positionIndex));

  let dx = 0;
  let dy = 0;
  let bestX = threshold;
  let bestY = threshold;

  for (const rect of candidates) {
    for (const target of xAnchors(rect)) {
      for (const line of selfX) {
        const delta = target - line;
        if (Math.abs(delta) < bestX) {
          bestX = Math.abs(delta);
          dx = delta;
        }
      }
    }
    for (const target of yAnchors(rect)) {
      for (const line of selfY) {
        const delta = target - line;
        if (Math.abs(delta) < bestY) {
          bestY = Math.abs(delta);
          dy = delta;
        }
      }
    }
  }

  if (dx === 0 && dy === 0) return changes;

  return changes.map((change) =>
    change.type === "position" && change.position && movingIds.has(change.id)
      ? { ...change, position: { x: change.position.x + dx, y: change.position.y + dy } }
      : change,
  );
}

function mergeGuides(guides: Guide[]): Guide[] {
  const map = new Map<string, Guide>();
  for (const guide of guides) {
    const key = `${guide.orientation}-${guide.position.toFixed(2)}`;
    const existing = map.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, guide.start);
      existing.end = Math.max(existing.end, guide.end);
    } else {
      map.set(key, { ...guide });
    }
  }
  return [...map.values()];
}

/**
 * Alignment lines for the nodes currently being dragged, computed from the
 * snapped positions in the store. Returns an empty list when no edges or
 * centers are exactly aligned with another node.
 */
export function computeGuidesForDragging(nodes: CanvasNode[], zoom: number): Guide[] {
  const index = byId(nodes);
  const movingIds = new Set(
    nodes.filter((node) => node.dragging === true && node.type !== "group").map((node) => node.id),
  );
  if (movingIds.size === 0) return [];

  const movingNodes = nodes.filter((node) => movingIds.has(node.id));
  const movingBounds = boundsOfRects(movingNodes.map((node) => nodeRect(node, index)));
  if (!movingBounds) return [];

  const epsilon = ALIGN_EPSILON_PX / Math.max(zoom, 0.01);
  const overflow = GUIDE_OVERFLOW_PX / Math.max(zoom, 0.01);
  const selfX = xAnchors(movingBounds);
  const selfY = yAnchors(movingBounds);
  const guides: Guide[] = [];

  for (const node of nodes) {
    if (!isAlignCandidate(node, movingIds, index)) continue;
    const rect = nodeRect(node, index);
    const top = Math.min(rect.y, movingBounds.y) - overflow;
    const bottom = Math.max(rect.y + rect.height, movingBounds.y + movingBounds.height) + overflow;
    const left = Math.min(rect.x, movingBounds.x) - overflow;
    const right = Math.max(rect.x + rect.width, movingBounds.x + movingBounds.width) + overflow;

    for (const target of xAnchors(rect)) {
      for (const line of selfX) {
        if (Math.abs(target - line) <= epsilon) {
          guides.push({ orientation: "vertical", position: line, start: top, end: bottom });
        }
      }
    }
    for (const target of yAnchors(rect)) {
      for (const line of selfY) {
        if (Math.abs(target - line) <= epsilon) {
          guides.push({ orientation: "horizontal", position: line, start: left, end: right });
        }
      }
    }
  }

  return mergeGuides(guides);
}

