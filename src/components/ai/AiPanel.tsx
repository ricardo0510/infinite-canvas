import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NodeToolbar, Position, useInternalNode, useViewport } from "@xyflow/react";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import { useUiStore } from "../../store/uiStore";
import type { GenerationMeta } from "../../types";
import { cancelGeneration, defaultGeneration, generateNode, kindOfNode, patchGeneration } from "../../lib/ai/controller";
import { defaultParams } from "../../lib/ai/models";
import { useAiModels } from "../../lib/ai/useModels";
import { Button } from "../ui/Button";
import { Select, Textarea } from "../ui/Control";
import { ErrorBanner } from "../ui/Feedback";
import { NodeSettingsDialog } from "./NodeSettingsDialog";

function isRunning(generation: GenerationMeta): boolean {
  return generation.status === "queued" || generation.status === "running";
}

export function AiPanel() {
  const nodeId = useUiStore((state) => state.aiPanelNodeId);
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === nodeId));
  const kind = kindOfNode(node);
  const modelsState = useAiModels(kind ?? "text");
  const models = modelsState.models;
  const generation = node
    ? ((node.data as { generation?: GenerationMeta }).generation ?? defaultGeneration(kind ?? "text"))
    : null;
  const model = models.find((item) => item.id === generation?.modelId) ?? models[0];
  const pushToast = useToastStore((state) => state.push);
  const [settingsNodeId, setSettingsNodeId] = useState<string | null>(null);
  const internalNode = useInternalNode(nodeId ?? "");
  const viewport = useViewport();
  const panelPosition = (() => {
    if (!internalNode) return Position.Bottom;
    const top = internalNode.internals.positionAbsolute.y * viewport.zoom + viewport.y;
    const height = (internalNode.measured.height ?? 0) * viewport.zoom;
    const bottom = top + height;
    const spaceBelow = (typeof window === "undefined" ? 900 : window.innerHeight) - bottom;
    return spaceBelow < 300 && top > spaceBelow ? Position.Top : Position.Bottom;
  })();
  const settingsOpen = settingsNodeId === nodeId;

  useEffect(() => {
    if (!nodeId || !kind || models.length === 0) return;
    const current = (node?.data as { generation?: GenerationMeta } | undefined)?.generation;
    const matched = models.some((item) => item.id === current?.modelId);
    if (matched) return;
    const next = models[0];
    patchGeneration(nodeId, {
      kind,
      modelId: next.id,
      mode: undefined,
      params: current?.params ?? defaultParams(next),
    });
  }, [kind, models, node, nodeId]);

  if (!nodeId || !node || !kind || !generation) return null;

  const running = isRunning(generation);

  const changeModel = (modelId: string) => {
    const next = models.find((item) => item.id === modelId);
    patchGeneration(nodeId, {
      modelId,
      mode: undefined,
      params: defaultParams(next),
    });
  };

  const onGenerate = async () => {
    try {
      await generateNode(nodeId);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "生成失败", "error");
    }
  };

  return (
    <>
      <NodeToolbar
        nodeId={nodeId}
        position={panelPosition}
        align="start"
        offset={panelPosition === Position.Top ? 58 : 18}
        isVisible
      >
        <div
          key={nodeId}
          className="ai-panel ai-panel-compact"
          data-ai-floating-editor
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Textarea
            className="ai-prompt"
            value={generation.prompt}
            placeholder={kind === "text" ? "写下你想生成的内容…" : "描述你想生成的画面，可连接上游素材…"}
            aria-label="Prompt"
            rows={5}
            onChange={(event) => patchGeneration(nodeId, { prompt: event.target.value })}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (!running) void onGenerate();
              }
            }}
          />

          <div className="ai-panel-bottom">
            <Select
              className="ai-model-select"
              value={model?.id ?? ""}
              options={models.map((item) => ({ value: item.id, label: item.name }))}
              placeholder={modelsState.loading ? "加载中…" : "无可用模型"}
              ariaLabel="Model"
              disabled={modelsState.loading || running}
              onChange={changeModel}
            />
            <Button
              size="md"
              disabled={running || !model}
              onClick={() => setSettingsNodeId(nodeId)}
            >
              配置
            </Button>
            <Button
              variant="primary"
              size="md"
              className="ai-generate-button"
              onClick={running ? () => void cancelGeneration(nodeId) : onGenerate}
              disabled={!running && (!model || !generation.prompt.trim())}
              title={running ? "取消等待" : "生成（Ctrl/Cmd + Enter）"}
            >
              {running ? "取消等待" : "生成"}
            </Button>
          </div>

          {generation.error ? (
            <ErrorBanner className="ai-error">{generation.error.message}</ErrorBanner>
          ) : null}
          {modelsState.error ? (
            <ErrorBanner className="ai-error">{modelsState.error}</ErrorBanner>
          ) : null}
        </div>
      </NodeToolbar>

      {settingsOpen
        ? createPortal(
            <NodeSettingsDialog
              nodeId={nodeId}
              model={model}
              generation={generation}
              onClose={() => setSettingsNodeId(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
