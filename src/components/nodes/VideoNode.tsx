import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useRef, type CSSProperties } from "react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../../lib/geometry";
import { sanitizeImageSrc, sanitizeVideoSrc } from "../../lib/storage";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { useCanvasStore } from "../../store/canvasStore";
import type { VideoNodeModel } from "../../types";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeLoadingOverlay } from "./NodeLoadingOverlay";
import { NodeTitleBar } from "./NodeTitleBar";
import { nodePropsEqual } from "./nodePropsEqual";

function VideoNodeImpl({ id, data, selected }: NodeProps<VideoNodeModel>) {
  const resizeNode = useCanvasStore((state) => state.resizeNode);
  const rawSrc = sanitizeVideoSrc(data.src);
  const src = useResolvedImageSrc(rawSrc);
  const poster = useResolvedImageSrc(sanitizeImageSrc(data.thumbnailUrl));
  const generation = data.generation;
  const running = generation?.status === "running" || generation?.status === "queued";
  const videoSized = useRef(false);

  const applyMediaHeight = (width: number, height: number) => {
    if (!(width > 0) || !(height > 0)) return;
    const next = mediaNodeHeight(AI_NODE_WIDTH, width, height);
    const current = useCanvasStore.getState().nodes.find((node) => node.id === id);
    if (current && Math.abs((current.height ?? 0) - next) < 1) return;
    resizeNode(id, AI_NODE_WIDTH, next);
  };

  return (
    <div
      className={`ai-node ai-node-video${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": "#f59e0b" } as CSSProperties}
    >
      <NodeTitleBar id={id} title={data.title} defaultTitle="视频" />
      <Handle type="target" position={Position.Left} className="node-handle" />
      {running ? (
        <NodeLoadingOverlay
          label={generation?.status === "queued" ? "排队中…" : "生成中"}
          progress={generation?.status === "running" ? generation?.progress : undefined}
        />
      ) : null}
      <div className="node-body nowheel">
        {src ? (
          <video
            className="node-video nodrag"
            src={src}
            poster={poster || undefined}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              videoSized.current = true;
              applyMediaHeight(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
            }}
          />
        ) : (
          <NodeEmptyState />
        )}
        {poster ? (
          <img
            className="node-measure"
            src={poster}
            alt=""
            aria-hidden="true"
            onLoad={(event) => {
              if (!videoSized.current) {
                applyMediaHeight(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
              }
            }}
          />
        ) : null}
        {generation?.error ? <p className="node-error">{generation.error.message}</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

export const VideoNode = memo(VideoNodeImpl, nodePropsEqual);
