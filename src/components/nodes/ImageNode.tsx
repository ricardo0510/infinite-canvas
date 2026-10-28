import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { MIN_SIZE } from "../../lib/geometry";
import { sanitizeImageSrc } from "../../lib/storage";
import { useCanvasStore } from "../../store/canvasStore";
import type { ImageNodeModel } from "../../types";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImageNode({ id, data, selected }: NodeProps<ImageNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const src = sanitizeImageSrc(data.src);

  const setSrc = (next: string) => {
    commit();
    updateNodeData(id, { src: sanitizeImageSrc(next) });
  };

  const loadFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is larger than 4 MB.");
      return;
    }
    try {
      setError(null);
      setSrc(await readFile(file));
    } catch {
      setError("Could not read that image.");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void loadFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={`image-node${selected ? " is-selected" : ""}`}
      style={{ "--note-accent": "#22d3ee" } as CSSProperties}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_SIZE.image.width}
        minHeight={MIN_SIZE.image.height}
        onResizeStart={() => commit()}
      />
      <Handle type="target" position={Position.Left} className="note-handle" />
      {src ? (
        <img className="image-preview" src={src} alt={data.alt || "Canvas image"} draggable={false} />
      ) : (
        <button
          type="button"
          className="nodrag image-empty"
          onClick={() => fileInput.current?.click()}
        >
          <span aria-hidden="true">＋</span>
          <span>Upload or drop an image</span>
        </button>
      )}
      <div className="image-bar">
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
        <button type="button" className="nodrag image-upload" onClick={() => fileInput.current?.click()}>
          Upload
        </button>
      </div>
      {error ? <p className="image-error">{error}</p> : null}
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
      <Handle type="source" position={Position.Right} className="note-handle" />
    </div>
  );
}
