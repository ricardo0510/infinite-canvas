import type { NodeProps } from "@xyflow/react";
import { memo, useRef } from "react";
import { NOTE_COLORS } from "../../lib/theme";
import { useCanvasStore } from "../../store/canvasStore";
import type { TextNodeModel } from "../../types";
import { NodeColors } from "./NodeColors";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeFrame } from "./NodeFrame";
import { nodePropsEqual } from "./nodePropsEqual";

function TextNodeImpl({ id, data, selected }: NodeProps<TextNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.emerald;
  const fontSize = Math.min(64, Math.max(10, data.fontSize || 16));
  const generation = data.generation;
  const running = generation?.status === "running" || generation?.status === "queued";
  const hasText = data.text.trim().length > 0;

  const handleEdit = (patch: { text?: string }) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateNodeData(id, patch);
  };

  return (
    <NodeFrame
      id={id}
      title={data.title}
      defaultTitle="文本"
      accent={accent}
      kind="text"
      selected={selected}
      running={running}
      loadingLabel={generation?.status === "queued" ? "排队中…" : "生成中…"}
      progress={generation?.status === "running" ? generation.progress : undefined}
      error={generation?.error?.message}
      actions={
        <NodeColors
          value={data.color}
          onChange={(color) => {
            commit();
            updateNodeData(id, { color });
          }}
        />
      }
    >
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
    </NodeFrame>
  );
}

export const TextNode = memo(TextNodeImpl, nodePropsEqual);
