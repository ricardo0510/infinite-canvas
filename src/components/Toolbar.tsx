import { useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { migrateInlineImagesNow } from "../lib/imageMigration";
import { exportSnapshot, parseSnapshot } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";
import { useUiStore } from "../store/uiStore";
import type { NodeKind } from "../types";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Input, Select } from "./ui/Control";

const ADD_ITEMS: { kind: NodeKind; label: string }[] = [
  { kind: "text", label: "文本节点" },
  { kind: "image", label: "图片节点" },
  { kind: "video", label: "视频节点" },
];

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const { fitView, screenToFlowPosition, setViewport } = useReactFlow();
  const addNode = useCanvasStore((state) => state.addNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const importSnapshot = useCanvasStore((state) => state.importSnapshot);
  const getSnapshot = useCanvasStore((state) => state.getSnapshot);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const setAiSettingsOpen = useUiStore((state) => state.setAiSettingsOpen);
  const pushToast = useToastStore((state) => state.push);
  const canUndo = useCanvasStore((state) => state.past.length > 0);
  const canRedo = useCanvasStore((state) => state.future.length > 0);

  const centerPosition = () => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
    });
  };

  const handleExport = () => {
    void exportSnapshot(getSnapshot())
      .then(({ skippedMedia }) => {
        if (skippedMedia > 0) {
          pushToast(
            `已导出，但有 ${skippedMedia} 个本地媒体未内联，换设备后可能无法播放。`,
            "info",
          );
        }
      })
      .catch(() => pushToast("导出失败。", "error"));
  };

  const handleAdd = (kind: NodeKind) => {
    addNode(kind, centerPosition());
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const snapshot = parseSnapshot(JSON.parse(await file.text()));
      if (!snapshot) {
        pushToast("这个 JSON 不是有效的画布快照。", "error");
        return;
      }
      importSnapshot(snapshot);
      void migrateInlineImagesNow();
      window.setTimeout(() => {
        if (snapshot.viewport) setViewport(snapshot.viewport);
        else fitView({ padding: 0.2, duration: 300 });
      }, 0);
      pushToast("画布已导入。", "success");
    } catch {
      pushToast("无法读取该 JSON 文件。", "error");
    }
  };

  return (
    <div className="toolbar">
      <Select
        className="new-node-select"
        menuClassName="context-menu"
        controlSize="lg"
        value=""
        options={ADD_ITEMS.map((item) => ({ value: item.kind, label: item.label }))}
        placeholder="新建节点"
        ariaLabel="新建节点"
        onChange={(kind) => handleAdd(kind as NodeKind)}
      />
      <span className="tool-divider" />
      <Button size="lg" onClick={undo} disabled={!canUndo} title="撤销（Ctrl/Cmd + Z）">
        <Icon name="undo" size={15} />
        <span className="tool-label">撤销</span>
      </Button>
      <Button size="lg" onClick={redo} disabled={!canRedo} title="重做（Ctrl/Cmd + Shift + Z）">
        <Icon name="redo" size={15} />
        <span className="tool-label">重做</span>
      </Button>
      <span className="tool-divider" />
      <Button size="lg" onClick={handleExport} title="导出 JSON">
        <Icon name="download" size={15} />
        <span className="tool-label">导出</span>
      </Button>
      <Button size="lg" onClick={() => fileInput.current?.click()} title="导入 JSON">
        <Icon name="upload" size={15} />
        <span className="tool-label">导入</span>
      </Button>
      <Button size="lg" onClick={() => setCommandOpen(true)} title="打开命令面板">
        <Icon name="command" size={15} />
        <span className="tool-label">命令</span>
      </Button>
      <Button size="lg" onClick={() => setAiSettingsOpen(true)} title="AI 设置">
        <Icon name="settings" size={15} />
        <span className="tool-label">AI 设置</span>
      </Button>
      <Button size="lg" onClick={() => setHelpOpen(true)} title="快捷键面板（?）">
        <Icon name="help" size={15} />
        <span className="tool-label">快捷键</span>
      </Button>
      <Input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={handleImport}
      />
    </div>
  );
}
