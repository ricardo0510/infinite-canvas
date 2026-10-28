import { useEffect, useRef } from "react";
import type { XYPosition } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";
import type { NodeKind } from "../types";

export type ContextMenuState = {
  x: number;
  y: number;
  flow: XYPosition;
  targetIds: string[];
  hasGroup: boolean;
};

type ContextMenuProps = {
  menu: ContextMenuState;
  onClose: () => void;
  onFitView: () => void;
};

const ADD_ITEMS: { kind: NodeKind; label: string }[] = [
  { kind: "note", label: "Note" },
  { kind: "text", label: "Text" },
  { kind: "image", label: "Image" },
  { kind: "group", label: "Group" },
];

export function ContextMenu({ menu, onClose, onFitView }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const addNode = useCanvasStore((state) => state.addNode);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const removeSelected = useCanvasStore((state) => state.removeSelected);
  const paste = useCanvasStore((state) => state.paste);
  const bringToFront = useCanvasStore((state) => state.bringToFront);
  const sendToBack = useCanvasStore((state) => state.sendToBack);
  const groupSelected = useCanvasStore((state) => state.groupSelected);
  const ungroupSelected = useCanvasStore((state) => state.ungroupSelected);
  const hasClipboard = useCanvasStore((state) => Boolean(state.clipboard));

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const selectTargets = () => selectNodes(menu.targetIds);

  const width = 208;
  const height = 430;
  const left = Math.min(menu.x, window.innerWidth - width - 8);
  const top = Math.min(menu.y, window.innerHeight - height - 8);

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.targetIds.length > 0 ? (
        <>
          <div className="context-label">
            {menu.targetIds.length === 1 ? "1 node selected" : `${menu.targetIds.length} nodes selected`}
          </div>
          <button type="button" role="menuitem" onClick={() => run(() => {
            selectTargets();
            duplicateSelected();
          })}>
            Duplicate <kbd>Ctrl D</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => bringToFront(menu.targetIds))}>
            Bring to front
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => sendToBack(menu.targetIds))}>
            Send to back
          </button>
          {menu.targetIds.length >= 2 ? (
            <button type="button" role="menuitem" onClick={() => run(() => {
              selectTargets();
              groupSelected();
            })}>
              Group selection
            </button>
          ) : null}
          {menu.hasGroup ? (
            <button type="button" role="menuitem" onClick={() => run(() => {
              selectTargets();
              ungroupSelected();
            })}>
              Ungroup
            </button>
          ) : null}
          <button type="button" role="menuitem" className="context-danger" onClick={() => run(() => {
            selectTargets();
            removeSelected();
          })}>
            Delete <kbd>Del</kbd>
          </button>
          <div className="context-divider" />
        </>
      ) : null}

      <div className="context-label">Add</div>
      {ADD_ITEMS.map((item) => (
        <button
          key={item.kind}
          type="button"
          role="menuitem"
          onClick={() => run(() => addNode(item.kind, menu.flow))}
        >
          {item.label}
        </button>
      ))}
      <div className="context-divider" />
      <button type="button" role="menuitem" onClick={() => run(paste)} disabled={!hasClipboard}>
        Paste <kbd>Ctrl V</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run(onFitView)}>
        Fit view
      </button>
    </div>
  );
}
