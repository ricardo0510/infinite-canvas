import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../../lib/geometry";
import { sanitizeImageSrc } from "../../lib/storage";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { NOTE_COLORS } from "../../lib/theme";
import { useCanvasStore } from "../../store/canvasStore";
import type { ImageNodeModel } from "../../types";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeFrame } from "./NodeFrame";
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
    <NodeFrame
      id={id}
      title={data.title}
      defaultTitle="图片"
      accent={NOTE_COLORS.cyan}
      kind="image"
      selected={selected}
      running={running}
      loadingLabel={generation?.status === "queued" ? "排队中…" : "生成中"}
      progress={generation?.status === "running" ? generation.progress : undefined}
      error={generation?.error?.message}
    >
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
    </NodeFrame>
  );
}

export const ImageNode = memo(ImageNodeImpl, nodePropsEqual);
