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
    <div className="toolbar" role="toolbar" aria-label="画布工具">
      <Select
        className="toolbar-add"
        menuClassName="context-menu"
        controlSize="lg"
        value=""
        options={ADD_ITEMS.map((item) => ({ value: item.kind, label: item.label }))}
        placeholder="添加节点"
        ariaLabel="添加节点"
        trigger={<Icon name="plus" size={18} />}
        onChange={(kind) => addNode(kind as NodeKind, centerPosition())}
      />
      <Button
        size="lg"
        icon
        onClick={undo}
        disabled={!canUndo}
        title="撤销（Ctrl/Cmd + Z）"
        aria-label="撤销"
      >
        <Icon name="undo" size={17} />
      </Button>
      <Button
        size="lg"
        icon
        onClick={redo}
        disabled={!canRedo}
        title="重做（Ctrl/Cmd + Shift + Z）"
        aria-label="重做"
      >
        <Icon name="redo" size={17} />
      </Button>
      <Button
        size="lg"
        icon
        onClick={() => setCommandOpen(true)}
        title="命令面板（/）"
        aria-label="命令面板"
      >
        <Icon name="command" size={17} />
      </Button>
      <Button
        size="lg"
        icon
        onClick={() => setAiSettingsOpen(true)}
        title="AI 设置"
        aria-label="AI 设置"
      >
        <Icon name="settings" size={17} />
      </Button>
      <Button
        size="lg"
        icon
        onClick={() => setHelpOpen(true)}
        title="快捷键（?）"
        aria-label="快捷键"
      >
        <Icon name="help" size={17} />
      </Button>
      <Button
        size="lg"
        icon
        onClick={() => fileInput.current?.click()}
        title="导入 JSON"
        aria-label="导入 JSON"
      >
        <Icon name="upload" size={17} />
      </Button>
      <Button size="lg" icon onClick={handleExport} title="导出 JSON" aria-label="导出 JSON">
        <Icon name="download" size={17} />
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
