import type { NodeProps } from "@xyflow/react";
import { memo, useRef } from "react";
import { NOTE_COLORS } from "../../lib/theme";
import { useCanvasStore } from "../../store/canvasStore";
import type { TextNodeModel } from "../../types";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Control";
import { NodeColors } from "./NodeColors";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeFrame } from "./NodeFrame";
import { nodePropsEqual } from "./nodePropsEqual";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 64;
const FONT_STEP = 2;

function TextNodeImpl({ id, data, selected }: NodeProps<TextNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.emerald;
  const fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, data.fontSize || 16));
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

  const changeFontSize = (delta: number) => {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
    if (next === fontSize) return;
    commit();
    updateNodeData(id, { fontSize: next });
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
      loadingLabel={generation?.status === "queued" ? "排队中" : "生成中"}
      progress={generation?.status === "running" ? generation.progress : undefined}
      error={generation?.error?.message}
      actions={
        <>
          <div className="font-stepper">
            <Button
              variant="ghost"
              size="xs"
              title="缩小字号"
              aria-label="缩小字号"
              disabled={fontSize <= MIN_FONT_SIZE}
              onClick={(event) => {
                event.stopPropagation();
                changeFontSize(-FONT_STEP);
              }}
            >
              A−
            </Button>
            <Button
              variant="ghost"
              size="xs"
              title="放大字号"
              aria-label="放大字号"
              disabled={fontSize >= MAX_FONT_SIZE}
              onClick={(event) => {
                event.stopPropagation();
                changeFontSize(FONT_STEP);
              }}
            >
              A+
            </Button>
          </div>
          <NodeColors
            value={data.color}
            onChange={(color) => {
              commit();
              updateNodeData(id, { color });
            }}
          />
        </>
      }
    >
      {hasText ? (
        <Textarea
          className="nodrag nowheel node-textarea"
          value={data.text}
          aria-label="文本内容"
          style={{ fontSize }}
          onContextMenu={(event) => event.preventDefault()}
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
