import { useEffect } from "react";
import type { GenerationMeta, GenerationParams, GenerationResultItem } from "../../types";
import { activateResult, patchGeneration } from "../../lib/ai/controller";
import type { AiModel } from "../../lib/ai/types";

type NodeSettingsDialogProps = {
  nodeId: string;
  model: AiModel | undefined;
  generation: GenerationMeta;
  onClose: () => void;
};

function resultLabel(item: GenerationResultItem): string {
  if (item.kind === "text") return item.text.slice(0, 60) || "文本";
  return item.kind === "image" ? "图片" : "视频";
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

export function NodeSettingsDialog({ nodeId, model, generation, onClose }: NodeSettingsDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const imageOutput = model?.output.image ?? null;
  const videoOutput = model?.output.video ?? null;
  const qualityTiers = model?.params?.qualityTiers ?? [];
  const backgrounds = model?.params?.backgrounds ?? [];
  const extraParams = model?.params?.extra ?? [];
  const running = generation.status === "queued" || generation.status === "running";

  const updateParams = (patch: Partial<GenerationParams>) => {
    patchGeneration(nodeId, { params: { ...(generation.params ?? {}), ...patch } });
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal node-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-settings-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="node-settings-head">
          <h2 id="node-settings-title">生成设置</h2>
          <button type="button" className="node-settings-close" onClick={onClose} aria-label="关闭设置">
            ×
          </button>
        </header>
        <div className="node-settings-body">
          {imageOutput ? (
            <>
              <label className="ai-field">
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
              <label className="ai-field">
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
              <label className="ai-field">
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
              <label className="ai-field">
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
              <label className="ai-field">
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
              <label className="ai-field">
                <span>时长（秒）</span>
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

          {qualityTiers.length > 0 ? (
            <label className="ai-field">
              <span>画质档</span>
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
            <label className="ai-field">
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

          {generation.kind === "text" ? (
            <>
              <label className="ai-field">
                <span>系统提示词</span>
                <textarea
                  rows={3}
                  value={generation.params?.systemPrompt ?? ""}
                  disabled={running}
                  onChange={(event) => updateParams({ systemPrompt: event.target.value })}
                />
              </label>
              <label className="ai-field">
                <span>温度</span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={generation.params?.temperature ?? 0.7}
                  disabled={running}
                  onChange={(event) => updateParams({ temperature: Number(event.target.value) })}
                />
              </label>
              <label className="ai-field">
                <span>最大输出长度</span>
                <input
                  type="number"
                  min={1}
                  max={32768}
                  value={generation.params?.maxOutputTokens ?? 2000}
                  disabled={running}
                  onChange={(event) => updateParams({ maxOutputTokens: Number(event.target.value) || 1 })}
                />
              </label>
            </>
          ) : null}

          {imageOutput || videoOutput ? (
            <label className="ai-field">
              <span>负向提示词</span>
              <textarea
                rows={2}
                value={generation.params?.negativePrompt ?? ""}
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

          {extraParams.map((param) => (
            <label key={param.key} className="ai-field">
              <span>{param.label}</span>
              <select
                value={String(generation.params?.extra?.[param.key] ?? param.defaultValue)}
                disabled={running}
                onChange={(event) =>
                  updateParams({ extra: { ...(generation.params?.extra ?? {}), [param.key]: event.target.value } })
                }
              >
                {param.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {generation.results.length > 0 ? (
            <div className="node-settings-results">
              <span>结果历史</span>
              <div className="ai-results">
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
