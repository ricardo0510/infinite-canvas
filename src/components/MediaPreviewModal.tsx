import { useEffect } from "react";
import { useResolvedImageSrc } from "../hooks/useResolvedImageSrc";
import { useUiStore } from "../store/uiStore";

export function MediaPreviewModal() {
  const preview = useUiStore((state) => state.mediaPreview);
  const setPreview = useUiStore((state) => state.setMediaPreview);
  const src = useResolvedImageSrc(preview?.src ?? "");

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, setPreview]);

  if (!preview) return null;

  return (
    <div className="media-preview-backdrop" onPointerDown={() => setPreview(null)}>
      <div
        className="media-preview"
        role="dialog"
        aria-modal="true"
        aria-label={preview.title || "媒体预览"}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="media-preview-head">
          <strong>{preview.title || (preview.kind === "image" ? "图片" : "视频")}</strong>
          <button type="button" className="media-preview-close" onClick={() => setPreview(null)} aria-label="关闭预览">
            ×
          </button>
        </div>
        <div className="media-preview-body">
          {preview.kind === "image" ? (
            src ? <img src={src} alt={preview.title || "预览"} /> : null
          ) : src ? (
            <video src={src} controls autoPlay playsInline />
          ) : null}
        </div>
      </div>
    </div>
  );
}
