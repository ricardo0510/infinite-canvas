export type TaskKind = "text" | "image" | "video";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

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

export type GenerationParams = {
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  duration?: number;
  qualityTier?: string;
  background?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  negativePrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
  extra?: Record<string, string | number | boolean>;
};

type BaseResultItem = {
  id: string;
  modelId: string;
  createdAt: string;
};

export type TextResultItem = BaseResultItem & {
  kind: "text";
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
};

export type ImageResultItem = BaseResultItem & {
  kind: "image";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  assetId?: string;
};

export type VideoResultItem = BaseResultItem & {
  kind: "video";
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  assetId?: string;
};

export type ResultItem = TextResultItem | ImageResultItem | VideoResultItem;

export type TaskResult = {
  kind: TaskKind;
  items: ResultItem[];
};

export type ApiTask = {
  taskId: string;
  kind: TaskKind;
  status: TaskStatus;
  progress?: number;
  modelId: string;
  mode: string;
  result: TaskResult | null;
  error: { code: number; message: string } | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};

export type InternalTask = ApiTask & {
  userId: string;
  clientRequestId: string;
  request: {
    prompt: string;
    params: GenerationParams;
    references: ReferenceInput[];
  };
};

export function toPublicTask(task: InternalTask): ApiTask {
  return {
    taskId: task.taskId,
    kind: task.kind,
    status: task.status,
    progress: task.progress,
    modelId: task.modelId,
    mode: task.mode,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: task.expiresAt,
  };
}

export type CreatedTask = {
  task: InternalTask;
  created: boolean;
};
