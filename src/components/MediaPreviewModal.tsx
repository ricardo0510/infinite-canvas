import { useResolvedImageSrc } from "../hooks/useResolvedImageSrc";
import { useUiStore } from "../store/uiStore";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export function MediaPreviewModal() {
  const preview = useUiStore((state) => state.mediaPreview);
  const setPreview = useUiStore((state) => state.setMediaPreview);
  const src = useResolvedImageSrc(preview?.src ?? "");

  if (!preview) return null;

  return (
    <Modal
      onClose={() => setPreview(null)}
      className="media-preview"
      backdropClassName="media-preview-backdrop"
      ariaLabel={preview.title || (preview.kind === "image" ? "图片预览" : "视频预览")}
    >
      <div className="media-preview-head">
        <strong>{preview.title || (preview.kind === "image" ? "图片" : "视频")}</strong>
        <Button size="md" icon className="media-preview-close" onClick={() => setPreview(null)} aria-label="关闭预览">
          ×
        </Button>
      </div>
      <div className="media-preview-body">
        {preview.kind === "image" ? (
          src ? <img src={src} alt={preview.title || "预览"} /> : null
        ) : src ? (
          <video src={src} controls autoPlay playsInline />
        ) : null}
      </div>
    </Modal>
  );
}
