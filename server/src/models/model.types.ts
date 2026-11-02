export const MODEL_KINDS = ["text", "image", "video"] as const;

export type ModelKind = (typeof MODEL_KINDS)[number];

export const MODEL_KIND_LABELS: Record<ModelKind, string> = {
  text: "文本",
  image: "图片",
  video: "视频",
};

export function isModelKind(value: unknown): value is ModelKind {
  return typeof value === "string" && (MODEL_KINDS as readonly string[]).includes(value);
}

export type ImageOutput = {
  aspectRatios: string[];
  resolutions: string[];
  maxCount: number;
};

export type VideoOutput = {
  aspectRatios: string[];
  resolutions: string[];
  minDuration: number;
  maxDuration: number;
  supportsAudio: boolean;
};

export type ModelExtraParam = {
  key: string;
  label: string;
  type: "select" | "slider";
  defaultValue: string;
  options: { label: string; value: string }[];
};

export type AiModel = {
  id: string;
  name: string;
  kind: ModelKind;
  modes: string[];
  description?: string;
  logoUrl?: string;
  limits: {
    maxPromptLength: number;
    maxImages: number;
    maxVideos: number;
  };
  output: {
    image: ImageOutput | null;
    video: VideoOutput | null;
  };
  params?: {
    qualityTiers?: { key: string; label: string }[];
    backgrounds?: string[];
    extra?: ModelExtraParam[];
  };
  pricing?: {
    baseCredits?: number;
    perSecondCredits?: number;
  };
};
