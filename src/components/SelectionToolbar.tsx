import { useCanvasStore } from "../store/canvasStore";
import type { AlignKind } from "../types";

const ALIGN: { kind: AlignKind; label: string; icon: string }[] = [
  { kind: "left", label: "左对齐", icon: "⇤" },
  { kind: "centerX", label: "水平居中", icon: "↔" },
  { kind: "right", label: "右对齐", icon: "⇥" },
  { kind: "top", label: "顶部对齐", icon: "⇡" },
  { kind: "centerY", label: "垂直居中", icon: "↕" },
  { kind: "bottom", label: "底部对齐", icon: "⇣" },
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
    <div className="selection-toolbar" role="toolbar" aria-label="选择操作">
      <span className="selection-count">已选中 {selectedCount} 个</span>
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
            title="水平分布"
            aria-label="水平分布"
            disabled={selectedCount < 3}
            onClick={() => distributeSelected("x")}
          >
            ≡
          </button>
          <button
            type="button"
            className="selection-button"
            title="垂直分布"
            aria-label="垂直分布"
            disabled={selectedCount < 3}
            onClick={() => distributeSelected("y")}
          >
            ⋮
          </button>
          <span className="selection-divider" />
          <button
            type="button"
            className="selection-button"
            title="合并分组（Ctrl/Cmd + G）"
            aria-label="合并分组"
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
          title="取消分组（Ctrl/Cmd + Shift + G）"
          aria-label="取消分组"
          onClick={ungroupSelected}
        >
          ▢
        </button>
      ) : null}
      <span className="selection-divider" />
      <button
        type="button"
        className="selection-button selection-danger"
        title="删除选中节点（Delete）"
        aria-label="删除选中节点"
        onClick={removeSelected}
      >
        ×
      </button>
    </div>
  );
}
