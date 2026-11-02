import { NOTE_COLORS } from "../../lib/theme";
import type { NoteColor } from "../../types";
import { Button } from "../ui/Button";

type NodeColorsProps = {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
};

const COLOR_LABELS: Record<NoteColor, string> = {
  violet: "灰蓝",
  cyan: "青灰",
  amber: "赭黄",
  emerald: "苔绿",
};

export function NodeColors({ value, onChange }: NodeColorsProps) {
  return (
    <div className="node-colors">
      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
        <Button
          key={color}
          variant="swatch"
          size="xs"
          active={value === color}
          className="nodrag"
          style={{ background: NOTE_COLORS[color] }}
          aria-label={`使用${COLOR_LABELS[color]}标记色`}
          title={`${COLOR_LABELS[color]}标记色`}
          onClick={(event) => {
            event.stopPropagation();
            onChange(color);
          }}
        />
      ))}
    </div>
  );
}
