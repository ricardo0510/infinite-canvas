import { useCallback, useState } from "react";
import { useStoreApi, type OnNodeDrag } from "@xyflow/react";
import { byId, nodeRect } from "../lib/geometry";
import { computeGuidesForDragging, type Guide } from "../lib/guides";
import { useCanvasStore } from "../store/canvasStore";
import type { CanvasNode } from "../types";

/** 节点拖拽时的对齐辅助线与入组/出组逻辑。 */
export function useNodeGrouping() {
  const flowStore = useStoreApi();
  const commit = useCanvasStore((state) => state.commit);
  const raiseNode = useCanvasStore((state) => state.raiseNode);
  const [guides, setGuides] = useState<Guide[]>([]);

  const clearGuides = useCallback(() => setGuides([]), []);

  const handleNodeDragStart: OnNodeDrag<CanvasNode> = useCallback(
    (_event, node) => {
      commit();
      raiseNode(node.id);
    },
    [commit, raiseNode],
  );

  const handleNodeDrag: OnNodeDrag<CanvasNode> = useCallback(() => {
    const zoom = flowStore.getState().transform[2] || 1;
    setGuides(computeGuidesForDragging(useCanvasStore.getState().nodes, zoom));
  }, [flowStore]);

  const handleNodeDragStop: OnNodeDrag<CanvasNode> = useCallback((_event, _node, draggedNodes) => {
    setGuides([]);
    // Dragging a group moves its children; it never enters another group.
    if (draggedNodes.some((node) => node.type === "group")) return;

    for (const dragged of draggedNodes) {
      const state = useCanvasStore.getState();
      const index = byId(state.nodes);
      const live = index.get(dragged.id);
      if (!live) continue;

      const rect = nodeRect(live, index);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const currentParent = live.parentId ?? null;

      // Pick the smallest containing group so nested groups behave sensibly.
      let target: CanvasNode | null = null;
      let targetArea = Number.POSITIVE_INFINITY;
      for (const candidate of state.nodes) {
        if (candidate.type !== "group" || candidate.id === currentParent) continue;
        const groupRect = nodeRect(candidate, index);
        const inside =
          centerX >= groupRect.x &&
          centerX <= groupRect.x + groupRect.width &&
          centerY >= groupRect.y &&
          centerY <= groupRect.y + groupRect.height;
        if (!inside) continue;
        const area = groupRect.width * groupRect.height;
        if (area < targetArea) {
          target = candidate;
          targetArea = area;
        }
      }

      if (target) {
        state.reparentNode(live.id, target.id);
        continue;
      }

      if (currentParent) {
        const parent = index.get(currentParent);
        if (!parent) {
          state.reparentNode(live.id, null);
          continue;
        }
        const parentRect = nodeRect(parent, index);
        const inside =
          centerX >= parentRect.x &&
          centerX <= parentRect.x + parentRect.width &&
          centerY >= parentRect.y &&
          centerY <= parentRect.y + parentRect.height;
        if (!inside) state.reparentNode(live.id, null);
      }
    }
  }, []);

  return { guides, clearGuides, handleNodeDragStart, handleNodeDrag, handleNodeDragStop };
}
