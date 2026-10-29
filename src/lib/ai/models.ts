import { aiRequest } from "./http";
import type { AiModel, ModelKind } from "./types";

let cached: AiModel[] | null = null;
let cachedAt = 0;
let inflight: Promise<AiModel[]> | null = null;
const CACHE_MS = 60_000;

export function clearModelCache(): void {
  cached = null;
  cachedAt = 0;
}

export async function listModels(kind?: ModelKind, force = false): Promise<AiModel[]> {
  const fresh = cached && Date.now() - cachedAt < CACHE_MS;
  if (!force && fresh && cached) {
    return kind ? cached.filter((model) => model.kind === kind) : cached;
  }
  if (inflight) {
    const models = await inflight;
    return kind ? models.filter((model) => model.kind === kind) : models;
  }
  inflight = (async () => {
    const data = await aiRequest<{ models: AiModel[] }>("/models", { timeout: 30_000 });
    const models = Array.isArray(data.models) ? data.models : [];
    cached = models;
    cachedAt = Date.now();
    return models;
  })();
  try {
    const models = await inflight;
    return kind ? models.filter((model) => model.kind === kind) : models;
  } finally {
    inflight = null;
  }
}

export async function getModel(modelId: string): Promise<AiModel | undefined> {
  if (!modelId) return undefined;
  try {
    const models = await listModels();
    return models.find((model) => model.id === modelId);
  } catch {
    return undefined;
  }
}

export async function defaultModelFor(kind: ModelKind): Promise<AiModel | undefined> {
  try {
    return (await listModels(kind))[0];
  } catch {
    return undefined;
  }
}

export function defaultParams(model: AiModel | undefined): {
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  duration?: number;
  qualityTier?: string;
  background?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  negativePrompt?: string;
  extra?: Record<string, string | number | boolean>;
} {
  if (!model) return { watermark: true };
  const image = model.output.image;
  const video = model.output.video;
  const extra: Record<string, string | number | boolean> = {};
  for (const item of model.params?.extra ?? []) {
    extra[item.key] = item.defaultValue;
  }
  return {
    ...(image
      ? {
          aspectRatio: image.aspectRatios[0],
          resolution: image.resolutions[0],
          count: 1,
          background: model.params?.backgrounds?.[0],
          qualityTier: model.params?.qualityTiers?.[0]?.key,
        }
      : {}),
    ...(video
      ? {
          aspectRatio: video.aspectRatios[0],
          resolution: video.resolutions[0],
          duration: video.minDuration,
          generateAudio: false,
          qualityTier: model.params?.qualityTiers?.[0]?.key,
        }
      : {}),
    watermark: true,
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}

