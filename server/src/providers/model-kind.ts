import type { ModelKind } from "../models/model.types";

const IMAGE_MARKERS = [
  "dall-e",
  "gpt-image",
  "flux",
  "stable-diffusion",
  "sdxl",
  "sd3",
  "midjourney",
  "ideogram",
  "recraft",
  "imagen",
  "image",
];

const VIDEO_MARKERS = [
  "sora",
  "veo",
  "kling",
  "runway",
  "pika",
  "luma",
  "hailuo",
  "minimax-video",
  "video",
  "t2v",
  "i2v",
  "cogvideo",
  "seedance",
  "wan2",
];

const NON_MODEL_MARKERS = [
  "embedding",
  "embed-",
  "whisper",
  "tts",
  "speech",
  "audio",
  "transcribe",
  "moderation",
  "rerank",
  "realtime",
];

export function isSupportedUpstreamModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return !NON_MODEL_MARKERS.some((marker) => lower.includes(marker));
}

export function inferModelKind(modelId: string): ModelKind {
  const lower = modelId.toLowerCase();
  if (VIDEO_MARKERS.some((marker) => lower.includes(marker))) return "video";
  if (IMAGE_MARKERS.some((marker) => lower.includes(marker))) return "image";
  return "text";
}
