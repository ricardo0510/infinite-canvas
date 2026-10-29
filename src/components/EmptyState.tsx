import { useReactFlow } from "@xyflow/react";
import { TEMPLATES } from "../lib/templates";
import { useCanvasStore } from "../store/canvasStore";
import type { NodeKind } from "../types";
import { Button } from "./ui/Button";

const ACTIONS: { kind: NodeKind; label: string; hint: string }[] = [
  { kind: "text", label: "文本", hint: "编写或生成文本" },
  { kind: "image", label: "图片", hint: "展示或生成图片" },
  { kind: "video", label: "视频", hint: "生成或播放视频" },
  { kind: "group", label: "分组", hint: "组织节点" },
];

export function EmptyState() {
  const isEmpty = useCanvasStore((state) => state.nodes.length === 0);
  const addNode = useCanvasStore((state) => state.addNode);
  const insertTemplate = useCanvasStore((state) => state.insertTemplate);
  const { screenToFlowPosition, fitView } = useReactFlow();

  if (!isEmpty) return null;

  const center = () => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
    });
  };

  const add = (kind: NodeKind) => {
    addNode(kind, center());
  };

  const applyTemplate = (templateId: string) => {
    const ids = insertTemplate(templateId, center());
    window.setTimeout(() => {
      fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.3,
        duration: 300,
        maxZoom: 1.25,
      });
    }, 0);
  };

  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>从空白画布开始</h2>
        <p>双击任意位置、右键查看更多，或在下方选择节点类型。</p>
        <div className="empty-actions">
          {ACTIONS.map((action) => (
            <Button
              key={action.kind}
              variant="card"
              onClick={() => add(action.kind)}
            >
              <strong>{action.label}</strong>
              <span>{action.hint}</span>
            </Button>
          ))}
        </div>
        <div className="empty-divider" />
        <p className="empty-templates-title">或从模板开始</p>
        <div className="empty-actions">
          {TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="card"
              className="empty-template"
              onClick={() => applyTemplate(template.id)}
            >
              <strong>{template.label}</strong>
              <span>{template.description}</span>
            </Button>
          ))}
        </div>
        <p className="empty-footnote">
          按 <kbd>?</kbd> 查看快捷键 · <kbd>/</kbd> 打开命令面板。
        </p>
      </div>
    </div>
  );
}

