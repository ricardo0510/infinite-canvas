import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../../lib/geometry";
import { sanitizeImageSrc } from "../../lib/storage";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { useCanvasStore } from "../../store/canvasStore";
import type { ImageNodeModel } from "../../types";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeLoadingOverlay } from "./NodeLoadingOverlay";
import { NodeTitleBar } from "./NodeTitleBar";
import { nodePropsEqual } from "./nodePropsEqual";

function ImageNodeImpl({ id, data, selected }: NodeProps<ImageNodeModel>) {
  const resizeNode = useCanvasStore((state) => state.resizeNode);
  const src = useResolvedImageSrc(sanitizeImageSrc(data.src));
  const generation = data.generation;
  const running = generation?.status === "running" || generation?.status === "queued";

  const applyMediaHeight = (width: number, height: number) => {
    if (!(width > 0) || !(height > 0)) return;
    const next = mediaNodeHeight(AI_NODE_WIDTH, width, height);
    const current = useCanvasStore.getState().nodes.find((node) => node.id === id);
    if (current && Math.abs((current.height ?? 0) - next) < 1) return;
    resizeNode(id, AI_NODE_WIDTH, next);
  };

  return (
    <div
      className={`ai-node ai-node-image${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": "#22d3ee" } as CSSProperties}
    >
      <NodeTitleBar id={id} title={data.title} defaultTitle="图片" />
      <Handle type="target" position={Position.Left} className="node-handle" />
      {running ? (
        <NodeLoadingOverlay
          label={generation?.status === "queued" ? "排队中…" : "生成中"}
          progress={generation?.status === "running" ? generation?.progress : undefined}
        />
      ) : null}
      <div className="node-body nowheel">
        {src ? (
          <img
            className="node-image"
            src={src}
            alt={data.alt || data.title || "画布图片"}
            draggable={false}
            onLoad={(event) => applyMediaHeight(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
          />
        ) : (
          <NodeEmptyState />
        )}
        {generation?.error ? <p className="node-error">{generation.error.message}</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeImpl, nodePropsEqual);
