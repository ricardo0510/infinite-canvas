import type {
  GenerationKind,
  GenerationParams,
  GenerationResultItem,
  GenerationUsage,
} from "../../types";

export type { GenerationKind, GenerationParams, GenerationResultItem, GenerationUsage };

export type ModelKind = GenerationKind;

export type ModelExtraOption = {
  label: string;
  value: string;
};

export type ModelExtraParam = {
  key: string;
  label: string;
  type: "select" | "slider";
  defaultValue: string;
  options: ModelExtraOption[];
};

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

export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type ApiTask = {
  taskId: string;
  kind: GenerationKind;
  status: TaskStatus;
  progress?: number;
  modelId: string;
  mode: string;
  result: {
    kind: GenerationKind;
    items: GenerationResultItem[];
  } | null;
  error: { code: number; message: string } | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};

export type ApiSubmitResult = {
  taskId: string;
  status: TaskStatus;
  createdAt: string;
};

export type UploadResult = {
  uploadId: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  assetId?: string;
};

export type ReferenceType =
  | "reference"
  | "referenceImage"
  | "firstFrame"
  | "lastFrame"
  | "referenceVideo";

export type ReferenceInput = {
  type: ReferenceType;
  url: string;
  assetId?: string;
};

export type UpstreamReference = {
  kind: "image" | "video";
  url: string;
};

export type GenerateInput = {
  nodeId: string;
  kind: GenerationKind;
  prompt: string;
  modelId: string;
  mode?: string;
  params: GenerationParams;
  references: ReferenceInput[];
  clientRequestId: string;
};

export type GenerationEvent =
  | { type: "accepted"; taskId: string }
  | { type: "progress"; progress: number }
  | { type: "completed"; results: GenerationResultItem[]; usage?: GenerationUsage }
  | { type: "failed"; error: { code: number; message: string } };

export type GenerateHandle = {
  cancel: () => Promise<void> | void;
};

export interface AiProvider {
  generate: (
    input: GenerateInput,
    emit: (event: GenerationEvent) => void,
  ) => Promise<GenerateHandle>;
}

export type AiRequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
};
