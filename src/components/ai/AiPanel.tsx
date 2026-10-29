import { useEffect } from "react";
import { NodeToolbar, Position, useInternalNode, useViewport } from "@xyflow/react";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import { useUiStore } from "../../store/uiStore";
import type {
  GenerationMeta,
  GenerationParams,
  GenerationResultItem,
} from "../../types";
import { isAiMock } from "../../lib/ai/config";
import {
  activateResult,
  cancelGeneration,
  defaultGeneration,
  generateNode,
  kindOfNode,
  patchGeneration,
} from "../../lib/ai/controller";
import { defaultParams } from "../../lib/ai/models";
import { useAiModels } from "../../lib/ai/useModels";
import type { AiModel } from "../../lib/ai/types";

const MODE_LABELS: Record<string, string> = {
  textToImage: "文生图",
  imageToImage: "图生图",
  textToVideo: "文生视频",
  imageToVideo: "图生视频",
  firstLastFrame: "首尾帧",
  referenceVideo: "参考视频",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "待生成",
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};

function modeFor(model: AiModel | undefined): string | undefined {
  if (!model) return undefined;
  return model.modes[0];
}

function isRunning(generation: GenerationMeta): boolean {
  return generation.status === "queued" || generation.status === "running";
}

function resultLabel(item: GenerationResultItem): string {
  if (item.kind === "text") return item.text.slice(0, 60) || "Text";
  return item.kind === "image" ? "Image" : "Video";
}

function ResultThumb({ item }: { item: GenerationResultItem }) {
  if (item.kind === "text") {
    return <span className="ai-result-text">{resultLabel(item)}</span>;
  }
  if (item.kind === "image") {
    return <img src={item.url} alt={resultLabel(item)} />;
  }
  return (
    <span className="ai-result-video">
      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={resultLabel(item)} /> : null}
      <span aria-hidden="true">▶</span>
    </span>
  );
}

export function AiPanel() {
  const nodeId = useUiStore((state) => state.aiPanelNodeId);
  const setPanelNode = useUiStore((state) => state.setAiPanelNode);
  const setSettingsOpen = useUiStore((state) => state.setAiSettingsOpen);
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === nodeId));
  const kind = kindOfNode(node);
  const modelsState = useAiModels(kind ?? "text");
  const models = modelsState.models;
  const generation = node
    ? ((node.data as { generation?: GenerationMeta }).generation ?? defaultGeneration(kind ?? "text"))
    : null;
  const model = models.find((item) => item.id === generation?.modelId) ?? models[0];
  const pushToast = useToastStore((state) => state.push);
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

  useEffect(() => {
    if (!nodeId || !kind || models.length === 0) return;
    const current = (node?.data as { generation?: GenerationMeta } | undefined)?.generation;
    const matched = models.some((item) => item.id === current?.modelId);
    if (matched) return;
    const next = models[0];
    patchGeneration(nodeId, {
      kind,
      modelId: next.id,
      mode: current?.mode ?? modeFor(next),
      params: current?.params ?? defaultParams(next),
    });
  }, [kind, models, node, nodeId]);

  if (!nodeId || !node || !kind || !generation) return null;

  const running = isRunning(generation);
  const output = model?.output;
  const imageOutput = output?.image ?? null;
  const videoOutput = output?.video ?? null;
  const qualityTiers = model?.params?.qualityTiers ?? [];
  const backgrounds = model?.params?.backgrounds ?? [];

  const updateParams = (patch: Partial<GenerationParams>) => {
    patchGeneration(nodeId, { params: { ...(generation.params ?? {}), ...patch } });
  };

  const changeModel = (modelId: string) => {
    const next = models.find((item) => item.id === modelId);
    patchGeneration(nodeId, {
      modelId,
      mode: modeFor(next),
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

  const title = node.data.title;

  return (
    <NodeToolbar nodeId={nodeId} position={panelPosition} align="start" offset={18} isVisible>
      <div
        key={nodeId}
        className="ai-panel"
        data-ai-floating-editor
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <div className="ai-panel-top">
          <span className="ai-panel-kind">
            {kind.toUpperCase()}
            {isAiMock() ? " · MOCK" : ""}
            {title ? ` · ${title}` : ""}
          </span>
          <div className="ai-panel-tools">
            <button type="button" className="ai-icon-button" onClick={() => setSettingsOpen(true)} title="AI settings">
              ⚙
            </button>
            <button type="button" className="ai-icon-button" onClick={() => setPanelNode(null)} title="Close">
              ×
            </button>
          </div>
        </div>

        <textarea
          className="ai-prompt"
          value={generation.prompt}
          placeholder={kind === "text" ? "写下你想生成的内容…" : "描述你想生成的画面，可连接上游素材…"}
          aria-label="Prompt"
          rows={4}
          autoFocus
          onChange={(event) => patchGeneration(nodeId, { prompt: event.target.value })}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void onGenerate();
            }
          }}
        />

        <div className="ai-config">
          <label className="ai-inline-field">
            <span>模型</span>
            <select
              value={model?.id ?? ""}
              disabled={modelsState.loading || running}
              onChange={(event) => changeModel(event.target.value)}
            >
              {models.length === 0 ? (
                <option value="">{modelsState.loading ? "加载中…" : "无可用模型"}</option>
              ) : null}
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {model && model.modes.length > 1 ? (
            <label className="ai-inline-field">
              <span>模式</span>
              <select
                value={generation.mode ?? modeFor(model) ?? ""}
                disabled={running}
                onChange={(event) => patchGeneration(nodeId, { mode: event.target.value })}
              >
                {model.modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_LABELS[mode] ?? mode}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {imageOutput ? (
            <>
              <label className="ai-inline-field">
                <span>比例</span>
                <select
                  value={generation.params?.aspectRatio ?? imageOutput.aspectRatios[0] ?? ""}
                  disabled={running}
                  onChange={(event) => updateParams({ aspectRatio: event.target.value })}
                >
                  {imageOutput.aspectRatios.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ai-inline-field">
                <span>分辨率</span>
                <select
                  value={generation.params?.resolution ?? imageOutput.resolutions[0] ?? ""}
                  disabled={running}
                  onChange={(event) => updateParams({ resolution: event.target.value })}
                >
                  {imageOutput.resolutions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ai-inline-field ai-inline-number">
                <span>数量</span>
                <input
                  type="number"
                  min={1}
                  max={imageOutput.maxCount}
                  value={generation.params?.count ?? 1}
                  disabled={running}
                  onChange={(event) => updateParams({ count: Number(event.target.value) || 1 })}
                />
              </label>
            </>
          ) : null}

          {videoOutput ? (
            <>
              <label className="ai-inline-field">
                <span>比例</span>
                <select
                  value={generation.params?.aspectRatio ?? videoOutput.aspectRatios[0] ?? ""}
                  disabled={running}
                  onChange={(event) => updateParams({ aspectRatio: event.target.value })}
                >
                  {videoOutput.aspectRatios.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ai-inline-field">
                <span>分辨率</span>
                <select
                  value={generation.params?.resolution ?? videoOutput.resolutions[0] ?? ""}
                  disabled={running}
                  onChange={(event) => updateParams({ resolution: event.target.value })}
                >
                  {videoOutput.resolutions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ai-inline-field ai-inline-number">
                <span>时长</span>
                <input
                  type="number"
                  min={videoOutput.minDuration}
                  max={videoOutput.maxDuration}
                  value={generation.params?.duration ?? videoOutput.minDuration}
                  disabled={running}
                  onChange={(event) =>
                    updateParams({ duration: Number(event.target.value) || videoOutput.minDuration })
                  }
                />
              </label>
            </>
          ) : null}
        </div>

        {qualityTiers.length > 0 || backgrounds.length > 0 || imageOutput || videoOutput ? (
          <div className="ai-config ai-config-secondary">
            {qualityTiers.length > 0 ? (
              <label className="ai-inline-field">
                <span>画质</span>
                <select
                  value={generation.params?.qualityTier ?? qualityTiers[0].key}
                  disabled={running}
                  onChange={(event) => updateParams({ qualityTier: event.target.value })}
                >
                  {qualityTiers.map((tier) => (
                    <option key={tier.key} value={tier.key}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {backgrounds.length > 0 ? (
              <label className="ai-inline-field">
                <span>背景</span>
                <select
                  value={generation.params?.background ?? backgrounds[0]}
                  disabled={running}
                  onChange={(event) => updateParams({ background: event.target.value })}
                >
                  {backgrounds.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {imageOutput || videoOutput ? (
              <label className="ai-inline-field ai-inline-wide">
                <span>负向提示词</span>
                <input
                  value={generation.params?.negativePrompt ?? ""}
                  placeholder="可选"
                  disabled={running}
                  onChange={(event) => updateParams({ negativePrompt: event.target.value })}
                />
              </label>
            ) : null}
            {videoOutput?.supportsAudio ? (
              <label className="ai-check">
                <input
                  type="checkbox"
                  checked={generation.params?.generateAudio === true}
                  disabled={running}
                  onChange={(event) => updateParams({ generateAudio: event.target.checked })}
                />
                <span>生成音频</span>
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="ai-actions">
          <button
            type="button"
            className="ai-primary"
            onClick={onGenerate}
            disabled={running || !model || !generation.prompt.trim()}
            title="Ctrl/Cmd + Enter"
          >
            {running ? "生成中…" : "生成"}
          </button>
          {running ? (
            <button type="button" className="ai-secondary" onClick={() => void cancelGeneration(nodeId)}>
              取消等待
            </button>
          ) : null}
          <span className={`ai-status ai-status-${generation.status}`}>
            {STATUS_LABELS[generation.status] ?? generation.status}
            {generation.progress !== undefined && running && kind !== "text"
              ? ` ${generation.progress}%`
              : ""}
          </span>
        </div>

        {running && kind !== "text" ? (
          <div
            className="ai-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={generation.progress ?? 0}
          >
            <span style={{ width: `${generation.progress ?? 0}%` }} />
          </div>
        ) : null}

        {generation.error ? (
          <p className="ai-error" role="alert">
            {generation.error.message}
          </p>
        ) : null}

        {modelsState.error ? <p className="ai-error">{modelsState.error}</p> : null}

        {generation.results.length > 0 ? (
          <div className="ai-results" aria-label="Generation results">
            {generation.results.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ai-result${generation.activeResultId === item.id ? " is-active" : ""}`}
                onClick={() => activateResult(nodeId, item.id)}
                title={resultLabel(item)}
              >
                <ResultThumb item={item} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </NodeToolbar>
  );
}
