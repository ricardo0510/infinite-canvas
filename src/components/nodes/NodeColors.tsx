import { NOTE_COLORS } from "../../store/canvasStore";
import type { NoteColor } from "../../types";

type NodeColorsProps = {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
};

const COLOR_LABELS: Record<NoteColor, string> = {
  violet: "紫罗兰",
  cyan: "青色",
  amber: "琥珀",
  emerald: "翠绿",
};

export function NodeColors({ value, onChange }: NodeColorsProps) {
  return (
    <div className="node-colors">
      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
        <button
          key={color}
          type="button"
          className={`nodrag color-dot${value === color ? " is-active" : ""}`}
          style={{ background: NOTE_COLORS[color] }}
          aria-label={`使用${COLOR_LABELS[color]}强调色`}
          title={COLOR_LABELS[color]}
          onClick={(event) => {
            event.stopPropagation();
            onChange(color);
          }}
        />
      ))}
    </div>
  );
}
