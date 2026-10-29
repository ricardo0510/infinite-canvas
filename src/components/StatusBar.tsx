import { useViewport } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";

export function StatusBar() {
  const nodeCount = useCanvasStore((state) => state.nodes.length);
  const edgeCount = useCanvasStore((state) => state.edges.length);
  const { zoom } = useViewport();

  return (
    <div className="statusbar" role="status">
      <span>{nodeCount} 个节点</span>
      <span className="statusbar-sep">·</span>
      <span>{edgeCount} 条连线</span>
      <span className="statusbar-sep">·</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span className="statusbar-hint">双击空白添加 · 拖拽端口连线</span>
    </div>
  );
}
