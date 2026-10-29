import type { GenerateInput, ReferenceInput } from "./types";
import type { GenerationParams } from "../../types";

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function baseParams(params: GenerationParams): Record<string, unknown> {
  return {
    ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {}),
    ...(params.resolution ? { resolution: params.resolution } : {}),
    ...(defined(params.count) ? { count: params.count } : {}),
    ...(defined(params.duration) ? { duration: params.duration } : {}),
    ...(params.qualityTier ? { qualityTier: params.qualityTier } : {}),
    ...(params.background ? { background: params.background } : {}),
    ...(defined(params.generateAudio) ? { generateAudio: params.generateAudio } : {}),
    ...(defined(params.watermark) ? { watermark: params.watermark } : {}),
    ...(defined(params.seed) ? { seed: params.seed } : {}),
    ...(params.extra && Object.keys(params.extra).length > 0 ? { extra: params.extra } : {}),
  };
}

function imageReferences(references: ReferenceInput[]): ReferenceInput[] {
  return references
    .filter((reference) => reference.type === "reference" || reference.type === "referenceImage")
    .map((reference) => ({ ...reference, type: "reference" as const }));
}

export function resolveImageMode(input: GenerateInput): string {
  if (input.mode === "textToImage" || input.mode === "imageToImage") return input.mode;
  return imageReferences(input.references).length > 0 ? "imageToImage" : "textToImage";
}

export function resolveVideoMode(input: GenerateInput): string {
  const hasVideo = input.references.some((reference) => reference.type === "referenceVideo");
  const firstFrames = input.references.filter((reference) => reference.type === "firstFrame");
  const lastFrames = input.references.filter((reference) => reference.type === "lastFrame");
  const images = input.references.filter((reference) => reference.type === "referenceImage");
  if (hasVideo) return "referenceVideo";
  if (firstFrames.length > 0 && lastFrames.length > 0) return "firstLastFrame";
  if (input.mode && ["textToVideo", "imageToVideo", "firstLastFrame", "referenceVideo"].includes(input.mode)) {
    return input.mode;
  }
  return images.length > 0 ? "imageToVideo" : "textToVideo";
}

export function buildTextBody(input: GenerateInput): Record<string, unknown> {
  const { params } = input;
  return {
    modelId: input.modelId,
    prompt: input.prompt,
    ...(params.systemPrompt ? { systemPrompt: params.systemPrompt } : {}),
    ...(defined(params.temperature) || defined(params.maxOutputTokens)
      ? {
          params: {
            ...(defined(params.temperature) ? { temperature: params.temperature } : {}),
            ...(defined(params.maxOutputTokens) ? { maxOutputTokens: params.maxOutputTokens } : {}),
          },
        }
      : {}),
    clientRequestId: input.clientRequestId,
  };
}

export function buildImageBody(input: GenerateInput): Record<string, unknown> {
  return {
    modelId: input.modelId,
    mode: resolveImageMode(input),
    prompt: input.prompt,
    ...(input.params.negativePrompt ? { negativePrompt: input.params.negativePrompt } : {}),
    ...(imageReferences(input.references).length > 0
      ? {
          references: imageReferences(input.references).map((reference) => ({
            type: "reference",
            url: reference.url,
            ...(reference.assetId ? { assetId: reference.assetId } : {}),
          })),
        }
      : {}),
    params: baseParams(input.params),
    clientRequestId: input.clientRequestId,
  };
}

export function buildVideoBody(input: GenerateInput): Record<string, unknown> {
  return {
    modelId: input.modelId,
    mode: resolveVideoMode(input),
    prompt: input.prompt,
    ...(input.params.negativePrompt ? { negativePrompt: input.params.negativePrompt } : {}),
    ...(input.references.length > 0
      ? {
          references: input.references.map((reference) => ({
            type: reference.type,
            url: reference.url,
            ...(reference.assetId ? { assetId: reference.assetId } : {}),
          })),
        }
      : {}),
    params: baseParams(input.params),
    clientRequestId: input.clientRequestId,
  };
}
