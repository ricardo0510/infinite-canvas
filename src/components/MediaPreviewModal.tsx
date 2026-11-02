import { useResolvedImageSrc } from "../hooks/useResolvedImageSrc";
import { useUiStore } from "../store/uiStore";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export function MediaPreviewModal() {
  const preview = useUiStore((state) => state.mediaPreview);
  const setPreview = useUiStore((state) => state.setMediaPreview);
  const src = useResolvedImageSrc(
    preview && preview.kind !== "text" ? preview.src : "",
  );

  if (!preview) return null;

  const fallbackTitle =
    preview.kind === "text" ? "文本" : preview.kind === "image" ? "图片" : "视频";

  return (
    <Modal
      onClose={() => setPreview(null)}
      className={`media-preview${preview.kind === "text" ? " text-preview" : ""}`}
      backdropClassName="media-preview-backdrop"
      ariaLabel={preview.title || fallbackTitle}
    >
      <div className="media-preview-head">
        <strong>{preview.title || fallbackTitle}</strong>
        {preview.kind === "text" ? (
          <span className="text-preview-count">{preview.text.length} 字</span>
        ) : null}
        <Button
          size="md"
          icon
          className="media-preview-close"
          onClick={() => setPreview(null)}
          aria-label="关闭预览"
        >
          ×
        </Button>
      </div>
      <div className={`media-preview-body${preview.kind === "text" ? " is-text" : ""}`}>
        {preview.kind === "text" ? (
          <article className="text-preview-content">{preview.text}</article>
        ) : preview.kind === "image" ? (
          src ? <img src={src} alt={preview.title || "预览"} /> : null
        ) : src ? (
          <video src={src} controls autoPlay playsInline />
        ) : null}
      </div>
    </Modal>
  );
}
