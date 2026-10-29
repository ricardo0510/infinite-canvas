import type { GenerationMeta, GenerationParams, GenerationResultItem } from "../../types";
import { activateResult, patchGeneration } from "../../lib/ai/controller";
import type { AiModel } from "../../lib/ai/types";
import { Field, SelectField } from "../ui/Field";
import { Modal } from "../ui/Modal";

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
    <Modal onClose={onClose} className="modal node-settings" labelledBy="node-settings-title">
      <header className="node-settings-head">
        <h2 id="node-settings-title">生成设置</h2>
        <button type="button" className="node-settings-close" onClick={onClose} aria-label="关闭设置">
          ×
        </button>
      </header>
      <div className="node-settings-body">
        {imageOutput ? (
          <>
            <SelectField
              label="比例"
              value={generation.params?.aspectRatio ?? imageOutput.aspectRatios[0] ?? ""}
              options={imageOutput.aspectRatios}
              disabled={running}
              onChange={(value) => updateParams({ aspectRatio: value })}
            />
            <SelectField
              label="分辨率"
              value={generation.params?.resolution ?? imageOutput.resolutions[0] ?? ""}
              options={imageOutput.resolutions}
              disabled={running}
              onChange={(value) => updateParams({ resolution: value })}
            />
            <Field label="数量">
              <input
                type="number"
                min={1}
                max={imageOutput.maxCount}
                value={generation.params?.count ?? 1}
                disabled={running}
                onChange={(event) => updateParams({ count: Number(event.target.value) || 1 })}
              />
            </Field>
          </>
        ) : null}

        {videoOutput ? (
          <>
            <SelectField
              label="比例"
              value={generation.params?.aspectRatio ?? videoOutput.aspectRatios[0] ?? ""}
              options={videoOutput.aspectRatios}
              disabled={running}
              onChange={(value) => updateParams({ aspectRatio: value })}
            />
            <SelectField
              label="分辨率"
              value={generation.params?.resolution ?? videoOutput.resolutions[0] ?? ""}
              options={videoOutput.resolutions}
              disabled={running}
              onChange={(value) => updateParams({ resolution: value })}
            />
            <Field label="时长（秒）">
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
            </Field>
          </>
        ) : null}

        {qualityTiers.length > 0 ? (
          <SelectField
            label="画质档"
            value={generation.params?.qualityTier ?? qualityTiers[0].key}
            options={qualityTiers.map((tier) => ({ value: tier.key, label: tier.label }))}
            disabled={running}
            onChange={(value) => updateParams({ qualityTier: value })}
          />
        ) : null}

        {backgrounds.length > 0 ? (
          <SelectField
            label="背景"
            value={generation.params?.background ?? backgrounds[0]}
            options={backgrounds}
            disabled={running}
            onChange={(value) => updateParams({ background: value })}
          />
        ) : null}

        {generation.kind === "text" ? (
          <>
            <Field label="系统提示词">
              <textarea
                rows={3}
                value={generation.params?.systemPrompt ?? ""}
                disabled={running}
                onChange={(event) => updateParams({ systemPrompt: event.target.value })}
              />
            </Field>
            <Field label="温度">
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={generation.params?.temperature ?? 0.7}
                disabled={running}
                onChange={(event) => updateParams({ temperature: Number(event.target.value) })}
              />
            </Field>
            <Field label="最大输出长度">
              <input
                type="number"
                min={1}
                max={32768}
                value={generation.params?.maxOutputTokens ?? 2000}
                disabled={running}
                onChange={(event) => updateParams({ maxOutputTokens: Number(event.target.value) || 1 })}
              />
            </Field>
          </>
        ) : null}

        {imageOutput || videoOutput ? (
          <Field label="负向提示词">
            <textarea
              rows={2}
              value={generation.params?.negativePrompt ?? ""}
              disabled={running}
              onChange={(event) => updateParams({ negativePrompt: event.target.value })}
            />
          </Field>
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
          <SelectField
            key={param.key}
            label={param.label}
            value={String(generation.params?.extra?.[param.key] ?? param.defaultValue)}
            options={param.options}
            disabled={running}
            onChange={(value) =>
              updateParams({ extra: { ...(generation.params?.extra ?? {}), [param.key]: value } })
            }
          />
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
                  aria-pressed={generation.activeResultId === item.id}
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
    </Modal>
  );
}
