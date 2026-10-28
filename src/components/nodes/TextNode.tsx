import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { memo, useRef, type CSSProperties } from "react";
import { MIN_SIZE } from "../../lib/geometry";
import { NOTE_COLORS, useCanvasStore } from "../../store/canvasStore";
import type { TextNodeModel } from "../../types";
import { NodeColors } from "./NodeColors";
import { nodePropsEqual } from "./nodePropsEqual";

function TextNodeImpl({ id, data, selected }: NodeProps<TextNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.emerald;
  const fontSize = Math.min(64, Math.max(10, data.fontSize || 16));

  const handleEdit = (patch: { text?: string }) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateNodeData(id, patch);
  };

  const changeSize = (delta: number) => {
    commit();
    updateNodeData(id, { fontSize: Math.min(64, Math.max(10, fontSize + delta)) });
  };

  return (
    <div
      className={`text-node${selected ? " is-selected" : ""}`}
      style={{ "--note-accent": accent } as CSSProperties}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_SIZE.text.width}
        minHeight={MIN_SIZE.text.height}
        onResizeStart={() => commit()}
      />
      <Handle type="target" position={Position.Left} className="note-handle" />
      <div className="text-tools">
        <button type="button" className="nodrag text-tool" onClick={() => changeSize(-2)} aria-label="Decrease font size">
          A−
        </button>
        <button type="button" className="nodrag text-tool" onClick={() => changeSize(2)} aria-label="Increase font size">
          A+
        </button>
        <NodeColors
          value={data.color}
          onChange={(color) => {
            commit();
            updateNodeData(id, { color });
          }}
        />
      </div>
      <textarea
        className="nodrag nowheel text-body"
        value={data.text}
        placeholder="Text"
        aria-label="Text content"
        style={{ fontSize }}
        onFocus={() => {
          editing.current = false;
        }}
        onChange={(event) => handleEdit({ text: event.target.value })}
      />
      <Handle type="source" position={Position.Right} className="note-handle" />
    </div>
  );
}


export const TextNode = memo(TextNodeImpl, nodePropsEqual);
