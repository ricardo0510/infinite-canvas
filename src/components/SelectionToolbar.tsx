import { useCanvasStore } from "../store/canvasStore";
import type { AlignKind } from "../types";

const ALIGN: { kind: AlignKind; label: string; icon: string }[] = [
  { kind: "left", label: "Align left", icon: "⇤" },
  { kind: "centerX", label: "Align horizontal centers", icon: "↔" },
  { kind: "right", label: "Align right", icon: "⇥" },
  { kind: "top", label: "Align top", icon: "⤒" },
  { kind: "centerY", label: "Align vertical centers", icon: "↕" },
  { kind: "bottom", label: "Align bottom", icon: "⤓" },
];

export function SelectionToolbar() {
  const selectedCount = useCanvasStore((state) => state.nodes.filter((node) => node.selected).length);
  const alignSelected = useCanvasStore((state) => state.alignSelected);
  const distributeSelected = useCanvasStore((state) => state.distributeSelected);
  const groupSelected = useCanvasStore((state) => state.groupSelected);
  const ungroupSelected = useCanvasStore((state) => state.ungroupSelected);
  const removeSelected = useCanvasStore((state) => state.removeSelected);
  const hasGroup = useCanvasStore((state) =>
    state.nodes.some((node) => node.selected && node.type === "group"),
  );

  if (selectedCount === 0) return null;

  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selection actions">
      <span className="selection-count">{selectedCount} selected</span>
      {selectedCount >= 2 ? (
        <>
          <span className="selection-divider" />
          {ALIGN.map((item) => (
            <button
              key={item.kind}
              type="button"
              className="selection-button"
              title={item.label}
              aria-label={item.label}
              onClick={() => alignSelected(item.kind)}
            >
              {item.icon}
            </button>
          ))}
          <span className="selection-divider" />
          <button
            type="button"
            className="selection-button"
            title="Distribute horizontally"
            aria-label="Distribute horizontally"
            disabled={selectedCount < 3}
            onClick={() => distributeSelected("x")}
          >
            ⇹
          </button>
          <button
            type="button"
            className="selection-button"
            title="Distribute vertically"
            aria-label="Distribute vertically"
            disabled={selectedCount < 3}
            onClick={() => distributeSelected("y")}
          >
            ⇳
          </button>
          <span className="selection-divider" />
          <button
            type="button"
            className="selection-button"
            title="Group selection (Ctrl/Cmd + G)"
            aria-label="Group selection"
            onClick={() => groupSelected()}
          >
            ▣
          </button>
        </>
      ) : null}
      {hasGroup ? (
        <button
          type="button"
          className="selection-button"
          title="Ungroup (Ctrl/Cmd + Shift + G)"
          aria-label="Ungroup"
          onClick={ungroupSelected}
        >
          ▢
        </button>
      ) : null}
      <span className="selection-divider" />
      <button
        type="button"
        className="selection-button selection-danger"
        title="Delete selected (Delete)"
        aria-label="Delete selected"
        onClick={removeSelected}
      >
        ✕
      </button>
    </div>
  );
}
