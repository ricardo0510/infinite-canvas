import { NOTE_COLORS } from "../../store/canvasStore";
import type { NoteColor } from "../../types";

type NodeColorsProps = {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
};

export function NodeColors({ value, onChange }: NodeColorsProps) {
  return (
    <div className="note-colors">
      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
        <button
          key={color}
          type="button"
          className={`nodrag color-dot${value === color ? " is-active" : ""}`}
          style={{ background: NOTE_COLORS[color] }}
          aria-label={`Use ${color} accent`}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
