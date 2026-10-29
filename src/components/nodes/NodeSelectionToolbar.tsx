import { NodeToolbar, Position } from "@xyflow/react";
import { sanitizeImageSrc, sanitizeVideoSrc } from "../../lib/storage";
import { useUiStore } from "../../store/uiStore";
import type { CanvasNode } from "../../types";

type NodeSelectionToolbarProps = {
  node: CanvasNode;
};

export function NodeSelectionToolbar({ node }: NodeSelectionToolbarProps) {
  const setMediaPreview = useUiStore((state) => state.setMediaPreview);

  if (node.type !== "image" && node.type !== "video") return null;
  const src = node.type === "image" ? sanitizeImageSrc(node.data.src) : sanitizeVideoSrc(node.data.src);
  if (!src) return null;

  return (
    <NodeToolbar nodeId={node.id} position={Position.Top} align="center" offset={10} isVisible>
      <div className="node-selection-toolbar">
        <button
          type="button"
          className="node-toolbar-button"
          title="全屏预览"
          aria-label="打开全屏预览"
          onClick={() =>
            setMediaPreview({
              kind: node.type === "image" ? "image" : "video",
              src,
              title: node.data.title || (node.type === "image" ? "图片" : "视频"),
            })
          }
        >
          <span aria-hidden="true">⛶</span>
        </button>
      </div>
    </NodeToolbar>
  );
}
