import type { Edge, Node } from "@xyflow/react";

export type NoteColor = "violet" | "cyan" | "amber" | "emerald";

export type NodeKind = "text" | "image" | "video" | "group";

export type GenerationKind = "text" | "image" | "video";

export type GenerationStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type GenerationError = {
  code: number;
  message: string;
};

export type GenerationUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type GenerationResultItem =
  | {
      id: string;
      kind: "text";
      text: string;
      modelId: string;
      createdAt: string;
      usage?: GenerationUsage;
    }
  | {
      id: string;
      kind: "image";
      url: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
      assetId?: string;
      modelId: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "video";
      url: string;
      thumbnailUrl?: string;
      duration?: number;
      width?: number;
      height?: number;
      assetId?: string;
      modelId: string;
      createdAt: string;
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

export type GenerationMeta = {
  kind: GenerationKind;
  prompt: string;
  modelId: string;
  mode?: string;
  status: GenerationStatus;
  progress?: number;
  taskId?: string;
  error?: GenerationError;
  results: GenerationResultItem[];
  activeResultId?: string;
  params?: GenerationParams;
  createdAt?: string;
  updatedAt?: string;
  stale?: boolean;
};

export type TextData = {
  title: string;
  text: string;
  color: NoteColor;
  fontSize: number;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type ImageData = {
  title: string;
  static?: boolean;
  src: string;
  alt: string;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type VideoData = {
  title: string;
  static?: boolean;
  src: string;
  thumbnailUrl: string;
  alt: string;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type GroupData = {
  label: string;
  color: NoteColor;
  [key: string]: unknown;
};

export type TextNodeModel = Node<TextData, "text">;
export type ImageNodeModel = Node<ImageData, "image">;
export type VideoNodeModel = Node<VideoData, "video">;
export type GroupNodeModel = Node<GroupData, "group">;

export type CanvasNode = TextNodeModel | ImageNodeModel | VideoNodeModel | GroupNodeModel;

export type CanvasEdge = Edge;

export type CanvasSnapshot = {
  version: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export type AlignKind = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
export type DistributeAxis = "x" | "y";
