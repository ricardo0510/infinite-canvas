import { useEffect, useRef } from "react";
import type { XYPosition } from "@xyflow/react";
import { createUploadedNode } from "../lib/upload";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";
import { useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";
import type { NodeKind } from "../types";

export type ContextMenuState = {
  x: number;
  y: number;
  flow: XYPosition;
  targetIds: string[];
  hasGroup: boolean;
  connection?: {
    fromNodeId: string;
    fromHandleType: "source" | "target";
  };
};

type ContextMenuProps = {
  menu: ContextMenuState;
  onClose: () => void;
  onFitView: () => void;
};

const ADD_ITEMS: { kind: NodeKind; label: string }[] = [
  { kind: "text", label: "文本" },
  { kind: "image", label: "图片" },
  { kind: "video", label: "视频" },
  { kind: "group", label: "分组" },
];

export function ContextMenu({ menu, onClose, onFitView }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useMenuKeyboard(ref, true);
  const addNode = useCanvasStore((state) => state.addNode);
  const addConnectedNode = useCanvasStore((state) => state.addConnectedNode);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const removeSelected = useCanvasStore((state) => state.removeSelected);
  const paste = useCanvasStore((state) => state.paste);
  const bringToFront = useCanvasStore((state) => state.bringToFront);
  const sendToBack = useCanvasStore((state) => state.sendToBack);
  const groupSelected = useCanvasStore((state) => state.groupSelected);
  const ungroupSelected = useCanvasStore((state) => state.ungroupSelected);
  const hasClipboard = useCanvasStore((state) => Boolean(state.clipboard));
  const pushToast = useToastStore((state) => state.push);

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
  const addItems = menu.connection
    ? ADD_ITEMS.filter((item) => item.kind !== "group")
    : ADD_ITEMS;

  const handleAdd = (kind: NodeKind) => {
    if (menu.connection) addConnectedNode(kind, menu.flow, menu.connection);
    else addNode(kind, menu.flow);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void createUploadedNode(file, menu.flow).catch((error: unknown) => {
        pushToast(error instanceof Error ? error.message : "上传失败。", "error");
      });
    };
    input.click();
  };

  const width = 208;
  const height = menu.connection ? 260 : 460;
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
      {menu.connection ? (
        <>
          <div className="context-label">
            {menu.connection.fromHandleType === "source" ? "添加下游节点" : "添加上游节点"}
          </div>
          {addItems.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => run(() => handleAdd(item.kind))}
            >
              {item.label}
            </button>
          ))}
        </>
      ) : (
        <>
          {menu.targetIds.length > 0 ? (
            <>
              <div className="context-label">
                {menu.targetIds.length === 1 ? "1 个节点已选中" : `${menu.targetIds.length} 个节点已选中`}
              </div>
              <button type="button" role="menuitem" onClick={() => run(() => {
                selectTargets();
                duplicateSelected();
              })}>
                复制 <kbd>Ctrl D</kbd>
              </button>
              <button type="button" role="menuitem" onClick={() => run(() => bringToFront(menu.targetIds))}>
                置于顶层
              </button>
              <button type="button" role="menuitem" onClick={() => run(() => sendToBack(menu.targetIds))}>
                置于底层
              </button>
              {menu.targetIds.length >= 2 ? (
                <button type="button" role="menuitem" onClick={() => run(() => {
                  selectTargets();
                  groupSelected();
                })}>
                  合并分组
                </button>
              ) : null}
              {menu.hasGroup ? (
                <button type="button" role="menuitem" onClick={() => run(() => {
                  selectTargets();
                  ungroupSelected();
                })}>
                  取消分组
                </button>
              ) : null}
              <button type="button" role="menuitem" className="context-danger" onClick={() => run(() => {
                selectTargets();
                removeSelected();
              })}>
                删除 <kbd>Del</kbd>
              </button>
              <div className="context-divider" />
            </>
          ) : null}

          <div className="context-label">添加</div>
          {addItems.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => run(() => handleAdd(item.kind))}
            >
              {item.label}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => run(handleUpload)}>
            上传文件
          </button>
          <div className="context-divider" />
          <button type="button" role="menuitem" onClick={() => run(paste)} disabled={!hasClipboard}>
            粘贴 <kbd>Ctrl V</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onFitView)}>
            适应视图
          </button>
        </>
      )}
    </div>
  );
}
