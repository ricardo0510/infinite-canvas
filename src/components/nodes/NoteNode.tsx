import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useRef, type CSSProperties } from "react";
import { MIN_SIZE } from "../../lib/geometry";
import { NOTE_COLORS, useCanvasStore } from "../../store/canvasStore";
import type { NoteNodeModel } from "../../types";
import { NodeColors } from "./NodeColors";

export function NoteNode({ id, data, selected }: NodeProps<NoteNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.violet;

  const handleEdit = (patch: { title?: string; body?: string }) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateNodeData(id, patch);
  };

  return (
    <div
      className={`note-node${selected ? " is-selected" : ""}`}
      style={{ "--note-accent": accent } as CSSProperties}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_SIZE.note.width}
        minHeight={MIN_SIZE.note.height}
        onResizeStart={() => commit()}
      />
      <Handle type="target" position={Position.Left} className="note-handle" />
      <div className="note-head">
        <span className="note-dot" />
        <input
          className="nodrag note-title"
          value={data.title}
          placeholder="Untitled"
          aria-label="Note title"
          onFocus={() => {
            editing.current = false;
          }}
          onChange={(event) => handleEdit({ title: event.target.value })}
        />
        <NodeColors
          value={data.color}
          onChange={(color) => {
            commit();
            updateNodeData(id, { color });
          }}
        />
      </div>
      <textarea
        className="nodrag nowheel note-body"
        value={data.body}
        placeholder="Write something…"
        aria-label="Note body"
        onFocus={() => {
          editing.current = false;
        }}
        onChange={(event) => handleEdit({ body: event.target.value })}
      />
      <Handle type="source" position={Position.Right} className="note-handle" />
    </div>
  );
}
