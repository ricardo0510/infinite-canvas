import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useRef, type CSSProperties } from "react";
import { NOTE_COLORS, useCanvasStore } from "../../store/canvasStore";
import type { CanvasNode, NoteColor } from "../../types";

export function NoteNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const updateNote = useCanvasStore((state) => state.updateNote);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.violet;

  const handleEdit = (patch: { title?: string; body?: string }) => {
    if (!editing.current) {
      commit();
      editing.current = true;
    }
    updateNote(id, patch);
  };

  return (
    <div
      className={`note-node${selected ? " is-selected" : ""}`}
      style={{ "--note-accent": accent } as CSSProperties}
    >
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
        <div className="note-colors">
          {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
            <button
              key={color}
              type="button"
              className={`nodrag color-dot${data.color === color ? " is-active" : ""}`}
              style={{ background: NOTE_COLORS[color] }}
              aria-label={`Use ${color} accent`}
              onClick={() => {
                commit();
                updateNote(id, { color });
              }}
            />
          ))}
        </div>
      </div>
      <textarea
        className="nodrag nowheel note-body"
        value={data.body}
        placeholder="Write something…"
        aria-label="Note body"
        rows={4}
        onFocus={() => {
          editing.current = false;
        }}
        onChange={(event) => handleEdit({ body: event.target.value })}
      />
      <Handle type="source" position={Position.Right} className="note-handle" />
    </div>
  );
}
