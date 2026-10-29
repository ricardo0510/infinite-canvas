import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../../lib/geometry";
import { storeImage } from "../../lib/imageStore";
import { readImageFile } from "../../lib/images";
import { sanitizeImageSrc } from "../../lib/storage";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { useCanvasStore } from "../../store/canvasStore";
import { useUiStore } from "../../store/uiStore";
import type { ImageNodeModel } from "../../types";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeLoadingOverlay } from "./NodeLoadingOverlay";
import { NodeTitleBar } from "./NodeTitleBar";
import { nodePropsEqual } from "./nodePropsEqual";

function ImageNodeImpl({ id, data, selected }: NodeProps<ImageNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const resizeNode = useCanvasStore((state) => state.resizeNode);
  const commit = useCanvasStore((state) => state.commit);
  const setAiPanelNode = useUiStore((state) => state.setAiPanelNode);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const rawSrc = sanitizeImageSrc(data.src);
  const src = useResolvedImageSrc(rawSrc);
  const generation = data.generation;
  const running = generation?.status === "running" || generation?.status === "queued";

  const applyMediaHeight = (width: number, height: number) => {
    if (!(width > 0) || !(height > 0)) return;
    const next = mediaNodeHeight(AI_NODE_WIDTH, width, height);
    const current = useCanvasStore.getState().nodes.find((node) => node.id === id);
    if (current && Math.abs((current.height ?? 0) - next) < 1) return;
    resizeNode(id, AI_NODE_WIDTH, next);
  };

  const setSrc = (next: string) => {
    commit();
    updateNodeData(id, { src: sanitizeImageSrc(next) });
  };

  const loadFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      setError(null);
      const image = await readImageFile(file);
      const ref = await storeImage(image.blob);
      commit();
      updateNodeData(id, { title: file.name, src: ref, alt: image.name });
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read that image.");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void loadFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={`ai-node ai-node-image${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": "#22d3ee" } as CSSProperties}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <NodeTitleBar id={id} title={data.title} defaultTitle="Image" />
      <Handle type="target" position={Position.Left} className="node-handle" />
      {running ? (
        <NodeLoadingOverlay
          label={generation?.status === "queued" ? "排队中…" : "生成中"}
          progress={generation?.status === "running" ? generation?.progress : undefined}
        />
      ) : null}
      <div className="node-body nodrag nowheel">
        {src ? (
          <img
            className="node-image"
            src={src}
            alt={data.alt || data.title || "Canvas image"}
            draggable={false}
            onLoad={(event) => applyMediaHeight(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
          />
        ) : (
          <NodeEmptyState />
        )}
        {generation?.error ? <p className="node-error">{generation.error.message}</p> : null}
        {error ? <p className="node-error">{error}</p> : null}
      </div>
      <div className="node-foot">
        {rawSrc.startsWith("data:") || rawSrc.startsWith("idb:") ? (
          <span className="image-uploaded" title={data.alt || "Uploaded image"}>
            {data.alt || data.title || "Uploaded image"}
          </span>
        ) : (
          <input
            className="nodrag image-url"
            value={data.src}
            placeholder="https://…"
            aria-label="Image URL"
            onChange={(event) => updateNodeData(id, { src: event.target.value })}
            onBlur={(event) => setSrc(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSrc(event.currentTarget.value);
            }}
          />
        )}
        <button type="button" className="nodrag image-upload" onClick={() => fileInput.current?.click()}>
          Upload
        </button>
        <button type="button" className="nodrag ai-node-button" onClick={() => setAiPanelNode(id)}>
          AI
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(event) => {
          void loadFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeImpl, nodePropsEqual);
