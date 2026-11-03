import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { previewOf, type NodePreview } from "../../lib/ai/refs";
import { sanitizeImageSrc, sanitizeVideoSrc } from "../../lib/storage";
import type { CanvasNode } from "../../types";
import { Icon } from "../ui/Icon";

function previewLabel(preview: NodePreview): string {
  if (preview.kind === "video") return "视频";
  if (preview.kind === "image") return "图片";
  if (preview.kind === "audio") return "音频";
  return "文本";
}

function Clip({ preview }: { preview: NodePreview }) {
  const imageSrc = useResolvedImageSrc(
    preview.kind === "image"
      ? sanitizeImageSrc(preview.url ?? "")
      : preview.kind === "video"
        ? sanitizeImageSrc(preview.poster ?? "")
        : "",
  );
  const videoSrc = useResolvedImageSrc(
    preview.kind === "video" ? sanitizeVideoSrc(preview.url ?? "") : "",
  );
  const hasText = preview.kind === "text" && Boolean(preview.text);

  return (
    <div className={`ai-upstream-clip ai-upstream-clip-${preview.kind}`} title={preview.title}>
      {preview.kind === "text" ? (
        hasText ? (
          <span className="ai-upstream-text">{preview.text}</span>
        ) : null
      ) : imageSrc ? (
        <img src={imageSrc} alt={preview.title} draggable={false} />
      ) : preview.kind === "video" && videoSrc ? (
        <video src={videoSrc} preload="metadata" muted playsInline />
      ) : preview.kind === "audio" ? (
        <span className="ai-upstream-icon" aria-hidden="true">
          <Icon name="audio" size={14} />
        </span>
      ) : null}
      {preview.kind === "video" && (imageSrc || videoSrc) ? (
        <span className="ai-upstream-play" aria-hidden="true">
          <Icon name="play" size={8} />
        </span>
      ) : null}
      {!hasText && !imageSrc && !videoSrc && preview.kind !== "audio" ? (
        <span className="ai-upstream-empty">{previewLabel(preview)}</span>
      ) : null}
    </div>
  );
}

export function UpstreamClips({ nodes }: { nodes: CanvasNode[] }) {
  const previews = nodes.map((node) => ({ id: node.id, preview: previewOf(node) }));
  const visible = previews.filter(
    (item): item is { id: string; preview: NodePreview } => item.preview !== null,
  );
  if (visible.length === 0) return null;

  return (
    <div className="ai-upstream" aria-label="上游引用">
      {visible.map((item) => (
        <Clip key={item.id} preview={item.preview} />
      ))}
    </div>
  );
}
