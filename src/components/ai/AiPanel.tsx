import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInternalNode, useViewport } from "@xyflow/react";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import { useUiStore } from "../../store/uiStore";
import type { GenerationKind, GenerationMeta } from "../../types";
import { cancelGeneration, defaultGeneration, generateNode, kindOfNode, patchGeneration } from "../../lib/ai/controller";
import { byId, nodeRect } from "../../lib/geometry";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  formatImageResolution,
} from "../../lib/ai/imageOptions";
import { defaultParams } from "../../lib/ai/models";
import { upstreamSourceNodes } from "../../lib/ai/refs";
import type { AiModel } from "../../lib/ai/types";
import { useAiModels } from "../../lib/ai/useModels";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Select, Textarea } from "../ui/Control";
import { ErrorBanner } from "../ui/Feedback";
import { NodeSettingsDialog } from "./NodeSettingsDialog";
import { UpstreamClips } from "./UpstreamClips";

function isRunning(generation: GenerationMeta): boolean {
  return generation.status === "queued" || generation.status === "running";
}

function configSummary(
  kind: GenerationKind,
  generation: GenerationMeta,
  model: AiModel | undefined,
): string[] {
  if (kind === "image") {
    const output = model?.output.image;
    return [
      formatImageResolution(
        generation.params?.resolution ?? output?.resolutions[0] ?? DEFAULT_IMAGE_RESOLUTION,
      ),
      generation.params?.aspectRatio ?? output?.aspectRatios[0] ?? DEFAULT_IMAGE_ASPECT_RATIO,
      `${generation.params?.count ?? 1}`,
    ];
  }
  if (kind === "audio") {
    const output = model?.output.audio;
    const items = [(generation.params?.format ?? output?.formats[0] ?? "wav").toUpperCase()];
    if (generation.params?.instructions?.trim()) items.push("情绪");
    return items;
  }
  if (kind !== "video") return [];

  const output = model?.output.video;
  const items: string[] = [];
  const resolution = generation.params?.resolution ?? output?.resolutions[0];
  if (resolution) items.push(resolution);
  const ratio = generation.params?.aspectRatio ?? output?.aspectRatios[0];
  if (ratio) items.push(ratio);
  const duration = generation.params?.duration ?? output?.minDuration;
  if (duration !== undefined) items.push(`${duration}s`);
  const tiers = model?.params?.qualityTiers ?? [];
  const tierKey = generation.params?.qualityTier ?? tiers[0]?.key;
  const tier = tiers.find((item) => item.key === tierKey);
  if (tier) items.push(tier.label);
  if (output?.supportsAudio && generation.params?.generateAudio) items.push("音频");
  return items;
}

type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

function overlapArea(a: Box, b: Box): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function placePanel(
  node: Box | null,
  panel: Size,
  viewport: Size,
  obstacles: Box[],
): { left: number; top: number } {
  const gap = 12;
  const margin = 12;
  const bottomInset = viewport.height > 700 ? 84 : 60;
  const width = Math.min(panel.width, viewport.width - margin * 2);
  const height = Math.min(panel.height, viewport.height - margin * 2);
  if (!node) return { left: margin, top: margin };

  const candidates = [
    { left: node.x + node.width + gap, top: node.y },
    { left: node.x - width - gap, top: node.y },
    { left: node.x, top: node.y + node.height + gap },
    { left: node.x, top: node.y - height - gap },
  ].filter(
    (candidate) =>
      candidate.left >= margin &&
      candidate.top >= margin &&
      candidate.left + width <= viewport.width - margin &&
      candidate.top + height <= viewport.height - margin - bottomInset,
  );

  if (candidates.length === 0) {
    return {
      left: Math.min(Math.max(node.x, margin), Math.max(margin, viewport.width - width - margin)),
      top: Math.min(
        Math.max(node.y + node.height + gap, margin),
        Math.max(margin, viewport.height - height - margin - bottomInset),
      ),
    };
  }

  const reserved: Box[] = [
    ...obstacles,
    {
      x: 0,
      y: viewport.height - 260,
      width: 220,
      height: 260,
    },
  ];

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const box = { x: candidate.left, y: candidate.top, width, height };
    const score = reserved.reduce((sum, item) => sum + overlapArea(box, item), 0);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function AiPanel() {
  const nodeId = useUiStore((state) => state.aiPanelNodeId);
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === nodeId));
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const upstream = useMemo(
    () => (nodeId ? upstreamSourceNodes(nodeId, nodes, edges) : []),
    [nodeId, nodes, edges],
  );
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState<Size>(() => ({
    width: Math.min(480, window.innerWidth - 24),
    height: 320,
  }));
  const [canvasBox, setCanvasBox] = useState<Box>(() => {
    const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
    return rect
      ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  });
  const settingsOpen = settingsNodeId === nodeId;

  useLayoutEffect(() => {
    const element = panelRef.current;
    if (!element) return;
    const update = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (!width || !height) return;
      setPanelSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [nodeId, settingsOpen]);

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(".canvas");
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      setCanvasBox((current) =>
        current.x === rect.left &&
        current.y === rect.top &&
        current.width === rect.width &&
        current.height === rect.height
          ? current
          : { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, []);

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
      params: defaultParams(next),
    });
  }, [kind, models, node, nodeId]);

  if (!nodeId || !node || !kind || !generation) return null;

  const running = isRunning(generation);
  const config = configSummary(kind, generation, model);

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

  const nodeIndex = byId(nodes);
  const nodeBox = internalNode
    ? {
        x: internalNode.internals.positionAbsolute.x * viewport.zoom + viewport.x,
        y: internalNode.internals.positionAbsolute.y * viewport.zoom + viewport.y,
        width: (internalNode.measured.width ?? 280) * viewport.zoom,
        height: (internalNode.measured.height ?? 160) * viewport.zoom,
      }
    : null;
  const obstacles = nodes
    .filter((item) => item.id !== nodeId && item.type !== "group")
    .map((item) => {
      const rect = nodeRect(item, nodeIndex);
      return {
        x: rect.x * viewport.zoom + viewport.x,
        y: rect.y * viewport.zoom + viewport.y,
        width: rect.width * viewport.zoom,
        height: rect.height * viewport.zoom,
      };
    });
  const panelWidth = Math.min(
    480,
    Math.max(260, canvasBox.width - 24),
    Math.max(340, Math.round(canvasBox.width * 0.72)),
  );
  const localPosition = placePanel(
    nodeBox,
    { width: panelWidth, height: panelSize.height },
    { width: canvasBox.width, height: canvasBox.height },
    obstacles,
  );
  const panelPosition = {
    left: canvasBox.x + localPosition.left,
    top: canvasBox.y + localPosition.top,
  };

  return (
    <>
      {createPortal(
        <div
          ref={panelRef}
          key={nodeId}
          className="ai-panel ai-panel-compact"
          data-ai-floating-editor
          style={{ left: panelPosition.left, top: panelPosition.top, width: panelWidth }}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <UpstreamClips nodes={upstream} />
          <Textarea
            className="ai-prompt"
            value={generation.prompt}
            placeholder={
              kind === "text"
                ? "写下你想生成的内容…"
                : kind === "audio"
                  ? "输入要朗读的台词或旁白，可连接上游文本节点…"
                  : "描述你想生成的画面，可连接上游素材…"
            }
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
            {config.length > 0 ? (
              <Button
                variant="secondary"
                size="md"
                className="ai-config-button"
                disabled={running || !model}
                onClick={() => setSettingsNodeId(nodeId)}
                title="生成设置"
              >
                <Icon name="settings" size={13} className="ai-config-icon" />
                <span className="ai-config-label">{config.join(" · ")}</span>
              </Button>
            ) : null}
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
        </div>,
        document.body,
      )}

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
