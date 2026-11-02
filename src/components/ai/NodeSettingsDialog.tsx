import type { GenerationMeta, GenerationParams, GenerationResultItem } from "../../types";
import { activateResult, patchGeneration } from "../../lib/ai/controller";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  formatImageResolution,
  IMAGE_ASPECT_RATIOS,
  IMAGE_MAX_COUNT,
  IMAGE_RESOLUTIONS,
} from "../../lib/ai/imageOptions";
import type { AiModel } from "../../lib/ai/types";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Control";
import { DialogHeader } from "../ui/DialogHeader";
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

function RatioShape({ ratio }: { ratio: string }) {
  const [widthValue, heightValue] = ratio.split(":").map(Number);
  const max = 22;
  if (
    !Number.isFinite(widthValue) ||
    !Number.isFinite(heightValue) ||
    widthValue <= 0 ||
    heightValue <= 0
  ) {
    return <span className="ratio-shape" style={{ width: max, height: max }} />;
  }
  const width = widthValue >= heightValue ? max : (max * widthValue) / heightValue;
  const height = widthValue >= heightValue ? (max * heightValue) / widthValue : max;
  return <span className="ratio-shape" style={{ width, height }} />;
}

export function NodeSettingsDialog({ nodeId, model, generation, onClose }: NodeSettingsDialogProps) {
  const isImage = generation.kind === "image";
  const videoOutput = model?.output.video ?? null;
  const qualityTiers = model?.params?.qualityTiers ?? [];
  const backgrounds = model?.params?.backgrounds ?? [];
  const extraParams = model?.params?.extra ?? [];
  const running = generation.status === "queued" || generation.status === "running";
  const imageAspectRatio =
    generation.params?.aspectRatio ?? DEFAULT_IMAGE_ASPECT_RATIO;
  const imageResolution =
    generation.params?.resolution ?? DEFAULT_IMAGE_RESOLUTION;

  const updateParams = (patch: Partial<GenerationParams>) => {
    patchGeneration(nodeId, { params: { ...(generation.params ?? {}), ...patch } });
  };

  return (
    <Modal onClose={onClose} className="modal node-settings" labelledBy="node-settings-title">
      <DialogHeader id="node-settings-title" title="生成设置" onClose={onClose} />
      <div className="node-settings-body">
        {isImage ? (
          <>
            <div className="settings-group">
              <span className="settings-label">画质</span>
              <div className="option-grid">
                {IMAGE_RESOLUTIONS.map((resolution) => (
                  <button
                    key={resolution}
                    type="button"
                    className={`option-tile${imageResolution === resolution ? " is-active" : ""}`}
                    aria-pressed={imageResolution === resolution}
                    disabled={running}
                    onClick={() => updateParams({ resolution })}
                  >
                    {formatImageResolution(resolution)}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group">
              <span className="settings-label">宽高比</span>
              <div className="option-grid option-grid--ratios">
                {IMAGE_ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className={`ratio-tile${imageAspectRatio === ratio ? " is-active" : ""}`}
                    aria-pressed={imageAspectRatio === ratio}
                    disabled={running}
                    onClick={() => updateParams({ aspectRatio: ratio })}
                  >
                    <RatioShape ratio={ratio} />
                    <span>{ratio}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="数量">
              <Input
                type="number"
                min={1}
                max={IMAGE_MAX_COUNT}
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
              <Input
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

        {!isImage && qualityTiers.length > 0 ? (
          <SelectField
            label="质量档位"
            value={generation.params?.qualityTier ?? qualityTiers[0].key}
            options={qualityTiers.map((tier) => ({ value: tier.key, label: tier.label }))}
            disabled={running}
            onChange={(value) => updateParams({ qualityTier: value })}
          />
        ) : null}

        {!isImage && backgrounds.length > 0 ? (
          <SelectField
            label="背景"
            value={generation.params?.background ?? backgrounds[0]}
            options={backgrounds}
            disabled={running}
            onChange={(value) => updateParams({ background: value })}
          />
        ) : null}

        {isImage || videoOutput ? (
          <Field label="负向提示词">
            <Textarea
              rows={2}
              value={generation.params?.negativePrompt ?? ""}
              disabled={running}
              onChange={(event) => updateParams({ negativePrompt: event.target.value })}
            />
          </Field>
        ) : null}

        {videoOutput?.supportsAudio ? (
          <label className="ai-check">
            <Input
              type="checkbox"
              checked={generation.params?.generateAudio === true}
              disabled={running}
              onChange={(event) => updateParams({ generateAudio: event.target.checked })}
            />
            <span>生成音频</span>
          </label>
        ) : null}

        {!isImage
          ? extraParams.map((param) => (
              <SelectField
                key={param.key}
                label={param.label}
                value={String(generation.params?.extra?.[param.key] ?? param.defaultValue)}
                options={param.options}
                disabled={running}
                onChange={(value) =>
                  updateParams({
                    extra: { ...(generation.params?.extra ?? {}), [param.key]: value },
                  })
                }
              />
            ))
          : null}

        {generation.results.length > 0 ? (
          <div className="node-settings-results">
            <span>结果历史</span>
            <div className="ai-results">
              {generation.results.map((item) => (
                <Button
                  key={item.id}
                  variant="tile"
                  active={generation.activeResultId === item.id}
                  aria-pressed={generation.activeResultId === item.id}
                  onClick={() => activateResult(nodeId, item.id)}
                  title={resultLabel(item)}
                >
                  <ResultThumb item={item} />
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
