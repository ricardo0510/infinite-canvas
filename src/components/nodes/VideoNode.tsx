import type { NodeProps } from "@xyflow/react";
import { memo, useRef } from "react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../../lib/geometry";
import { sanitizeImageSrc, sanitizeVideoSrc } from "../../lib/storage";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { NOTE_COLORS } from "../../lib/theme";
import { useCanvasStore } from "../../store/canvasStore";
import type { VideoNodeModel } from "../../types";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeFrame } from "./NodeFrame";
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
    <NodeFrame
      id={id}
      title={data.title}
      defaultTitle="视频"
      accent={NOTE_COLORS.amber}
      kind="video"
      selected={selected}
      running={running}
      loadingLabel={generation?.status === "queued" ? "排队中…" : "生成中"}
      progress={generation?.status === "running" ? generation.progress : undefined}
      error={generation?.error?.message}
    >
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
    </NodeFrame>
  );
}

export const VideoNode = memo(VideoNodeImpl, nodePropsEqual);
