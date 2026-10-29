import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useRef, type CSSProperties } from "react";
import { NOTE_COLORS, useCanvasStore } from "../../store/canvasStore";
import type { TextNodeModel } from "../../types";
import { NodeColors } from "./NodeColors";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeLoadingOverlay } from "./NodeLoadingOverlay";
import { NodeTitleBar } from "./NodeTitleBar";
import { nodePropsEqual } from "./nodePropsEqual";

function TextNodeImpl({ id, data, selected }: NodeProps<TextNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.emerald;
  const fontSize = Math.min(64, Math.max(10, data.fontSize || 16));
  const running = data.generation?.status === "running" || data.generation?.status === "queued";
  const hasText = data.text.trim().length > 0;

  const handleEdit = (patch: { text?: string }) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateNodeData(id, patch);
  };

  return (
    <div
      className={`ai-node ai-node-text${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": accent } as CSSProperties}
    >
      <NodeTitleBar
        id={id}
        title={data.title}
        defaultTitle="文本"
        actions={
          <NodeColors
            value={data.color}
            onChange={(color) => {
              commit();
              updateNodeData(id, { color });
            }}
          />
        }
      />
      <Handle type="target" position={Position.Left} className="node-handle" />
      {running ? (
        <NodeLoadingOverlay
          label={data.generation?.status === "queued" ? "排队中…" : "生成中…"}
          progress={data.generation?.status === "running" ? data.generation?.progress : undefined}
        />
      ) : null}
      <div className="node-body nowheel">
        {hasText ? (
          <textarea
            className="nodrag nowheel node-textarea"
            value={data.text}
            aria-label="文本内容"
            style={{ fontSize }}
            onFocus={() => {
              editing.current = false;
            }}
            onChange={(event) => handleEdit({ text: event.target.value })}
          />
        ) : (
          <NodeEmptyState />
        )}
        {data.generation?.error ? <p className="node-error">{data.generation.error.message}</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

export const TextNode = memo(TextNodeImpl, nodePropsEqual);
