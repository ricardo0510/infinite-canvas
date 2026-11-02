import type { ModelKind } from "../models/model.types";

export type ProviderContext = {
  baseUrl: string;
  apiKey: string;
  authType: string;
  timeoutMs: number;
  extra?: Record<string, unknown>;
};

export type ProviderModelInfo = {
  modelId: string;
  displayName: string;
  kind: ModelKind;
  capabilities?: Record<string, unknown>;
};

export type TextInput = {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type TextOutput = {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
};

export type ImageInput = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  count: number;
  negativePrompt?: string;
  watermark?: boolean;
  seed?: number;
  referenceUrls?: string[];
};

export type ImageOutput = {
  url: string;
  width?: number;
  height?: number;
};

export type VideoInput = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  negativePrompt?: string;
  generateAudio?: boolean;
  seed?: number;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
};

export type VideoOutput = {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type VideoPollResult = {
  status: "queued" | "running" | "succeeded" | "failed";
  video?: VideoOutput;
  message?: string;
};

export type ProviderTestResult = {
  ok: boolean;
  message?: string;
};

export class UpstreamAuthError extends Error {
  constructor(message = "上游拒绝了当前 API Key") {
    super(message);
    this.name = "UpstreamAuthError";
  }
}

export interface ProviderAdapter {
  listModels(ctx: ProviderContext): Promise<ProviderModelInfo[]>;
  testKey(ctx: ProviderContext): Promise<ProviderTestResult>;
  generateText?(ctx: ProviderContext, input: TextInput): Promise<TextOutput>;
  generateImage?(ctx: ProviderContext, input: ImageInput): Promise<ImageOutput[]>;
  submitVideo?(
    ctx: ProviderContext,
    input: VideoInput,
  ): Promise<{ providerTaskId: string; width?: number; height?: number }>;
  pollVideo?(ctx: ProviderContext, providerTaskId: string): Promise<VideoPollResult>;
}
