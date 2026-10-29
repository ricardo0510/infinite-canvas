import type { MarkerType } from "@xyflow/react";
import { DEFAULT_SIZE } from "./geometry";
import { blobToDataUrl, getImageBlob, isIdbImageRef } from "./imageStore";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasSnapshot,
  GenerationError,
  GenerationKind,
  GenerationMeta,
  GenerationParams,
  GenerationResultItem,
  GenerationStatus,
  GroupData,
  ImageData,
  NodeKind,
  NoteColor,
  TextData,
  VideoData,
} from "../types";

export const SCHEMA_VERSION = 5;

const STORAGE_KEY = "infinite-canvas:v5";
const LEGACY_KEYS = ["infinite-canvas:v4", "infinite-canvas:v3", "infinite-canvas:v2", "infinite-canvas:v1"];
const MAX_ZOOM = 8;
const MAX_GENERATION_RESULTS = 20;
const MAX_GENERATION_PROMPT = 20_000;
const MAX_ERROR_MESSAGE = 500;

const NODE_KINDS: NodeKind[] = ["text", "image", "video", "group"];
const COLORS: NoteColor[] = ["violet", "cyan", "amber", "emerald"];
const GENERATION_KINDS: GenerationKind[] = ["text", "image", "video"];
const GENERATION_STATUSES: GenerationStatus[] = [
  "idle",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const IDB_REF = /^idb:[A-Za-z0-9-]+$/i;
const EXTRA_VALUE = /^(string|number|boolean)$/;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function color(value: unknown): NoteColor {
  return COLORS.includes(value as NoteColor) ? (value as NoteColor) : "violet";
}

function kind(value: unknown): NodeKind {
  return NODE_KINDS.includes(value as NodeKind) ? (value as NodeKind) : "text";
}

function safeId(value: unknown): string | undefined {
  const id = text(value).trim();
  return id && SAFE_ID.test(id) ? id : undefined;
}

function clampProgress(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Only local, uploaded, or https images are allowed. */
export function sanitizeImageSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const src = value.trim();
  if (/^https:\/\//i.test(src)) return src;
  if (/^blob:/i.test(src)) return src;
  if (/^data:image\//i.test(src)) return src;
  if (IDB_REF.test(src)) return src;
  return "";
}

export function sanitizeVideoSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const src = value.trim();
  if (/^https:\/\//i.test(src)) return src;
  if (/^blob:/i.test(src)) return src;
  if (/^data:video\//i.test(src)) return src;
  if (IDB_REF.test(src)) return src;
  return "";
}

function sanitizeMediaUrl(value: unknown, mediaKind: "image" | "video"): string {
  const src = typeof value === "string" ? value.trim() : "";
  if (!src) return "";
  if (/^https:\/\//i.test(src)) return src;
  if (IDB_REF.test(src)) return src;
  if (mediaKind === "image" && /^data:image\//i.test(src)) return src;
  if (mediaKind === "video" && /^data:video\//i.test(src)) return src;
  return "";
}

function sanitizeError(value: unknown): GenerationError | undefined {
  if (!isRecord(value)) return undefined;
  const code = typeof value.code === "number" && Number.isFinite(value.code) ? value.code : -1;
  const message = text(value.message).slice(0, MAX_ERROR_MESSAGE);
  if (!message) return undefined;
  return { code, message };
}

function sanitizeParams(value: unknown): GenerationParams | undefined {
  if (!isRecord(value)) return undefined;
  const params: GenerationParams = {};
  const ratio = text(value.aspectRatio).trim();
  if (ratio) params.aspectRatio = ratio;
  const resolution = text(value.resolution).trim();
  if (resolution) params.resolution = resolution;
  const count = optionalNumber(value.count);
  if (count !== undefined) params.count = Math.min(4, Math.max(1, Math.round(count)));
  const duration = optionalNumber(value.duration);
  if (duration !== undefined) params.duration = Math.max(1, Math.round(duration));
  const qualityTier = text(value.qualityTier).trim();
  if (qualityTier) params.qualityTier = qualityTier;
  const background = text(value.background).trim();
  if (background) params.background = background;
  if (typeof value.generateAudio === "boolean") params.generateAudio = value.generateAudio;
  if (typeof value.watermark === "boolean") params.watermark = value.watermark;
  const seed = optionalNumber(value.seed);
  if (seed !== undefined) params.seed = Math.round(seed);
  const negativePrompt = text(value.negativePrompt);
  if (negativePrompt) params.negativePrompt = negativePrompt.slice(0, 2000);
  const temperature = optionalNumber(value.temperature);
  if (temperature !== undefined) params.temperature = Math.min(2, Math.max(0, temperature));
  const maxOutputTokens = optionalNumber(value.maxOutputTokens);
  if (maxOutputTokens !== undefined) params.maxOutputTokens = Math.min(32_768, Math.max(1, Math.round(maxOutputTokens)));
  const systemPrompt = text(value.systemPrompt);
  if (systemPrompt) params.systemPrompt = systemPrompt.slice(0, 8000);
  if (isRecord(value.extra)) {
    const extra: Record<string, string | number | boolean> = {};
    for (const [key, item] of Object.entries(value.extra)) {
      if (!SAFE_ID.test(key)) continue;
      if (!EXTRA_VALUE.test(typeof item)) continue;
      if (typeof item === "string" && item.length > 500) continue;
      extra[key] = item as string | number | boolean;
    }
    if (Object.keys(extra).length > 0) params.extra = extra;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function sanitizeResult(value: unknown): GenerationResultItem | null {
  if (!isRecord(value)) return null;
  const itemKind = value.kind;
  if (itemKind !== "text" && itemKind !== "image" && itemKind !== "video") return null;
  const id = safeId(value.id);
  if (!id) return null;
  const modelId = text(value.modelId).slice(0, 200);
  const createdAt = text(value.createdAt);
  if (itemKind === "text") {
    const body = text(value.text);
    if (!body) return null;
    const usage = isRecord(value.usage)
      ? {
          inputTokens: optionalNumber(value.usage.inputTokens),
          outputTokens: optionalNumber(value.usage.outputTokens),
        }
      : undefined;
    return {
      id,
      kind: "text",
      text: body,
      modelId,
      createdAt,
      ...(usage ? { usage } : {}),
    };
  }
  const url = sanitizeMediaUrl(value.url, itemKind);
  if (!url) return null;
  const thumbnailUrl = sanitizeMediaUrl(value.thumbnailUrl, "image");
  const width = optionalNumber(value.width);
  const height = optionalNumber(value.height);
  const assetId = safeId(value.assetId);
  if (itemKind === "image") {
    return {
      id,
      kind: "image",
      url,
      modelId,
      createdAt,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(assetId ? { assetId } : {}),
    };
  }
  const duration = optionalNumber(value.duration);
  return {
    id,
    kind: "video",
    url,
    modelId,
    createdAt,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(assetId ? { assetId } : {}),
  };
}

export function sanitizeGeneration(value: unknown): GenerationMeta | undefined {
  if (!isRecord(value)) return undefined;
  const generationKind = value.kind;
  const status = value.status;
  if (!GENERATION_KINDS.includes(generationKind as GenerationKind)) return undefined;
  if (!GENERATION_STATUSES.includes(status as GenerationStatus)) return undefined;
  const results = Array.isArray(value.results)
    ? value.results
        .map(sanitizeResult)
        .filter((item): item is GenerationResultItem => item !== null)
        .slice(0, MAX_GENERATION_RESULTS)
    : [];
  const resultIds = new Set(results.map((item) => item.id));
  const activeResultId = safeId(value.activeResultId);
  const taskId = safeId(value.taskId);
  const error = sanitizeError(value.error);
  const params = sanitizeParams(value.params);
  return {
    kind: generationKind as GenerationKind,
    prompt: text(value.prompt).slice(0, MAX_GENERATION_PROMPT),
    modelId: text(value.modelId).slice(0, 200),
    status: status as GenerationStatus,
    results,
    ...(text(value.mode) ? { mode: text(value.mode).slice(0, 64) } : {}),
    ...(taskId ? { taskId } : {}),
    ...(error ? { error } : {}),
    ...(activeResultId && resultIds.has(activeResultId) ? { activeResultId } : {}),
    ...(params ? { params } : {}),
    ...(typeof value.progress === "number" ? { progress: clampProgress(value.progress) } : {}),
    ...(text(value.createdAt) ? { createdAt: text(value.createdAt) } : {}),
    ...(text(value.updatedAt) ? { updatedAt: text(value.updatedAt) } : {}),
    ...(value.stale === true ? { stale: true } : {}),
  };
}

function position(value: unknown): { x: number; y: number } {
  if (!isRecord(value)) return { x: 0, y: 0 };
  return { x: number(value.x, 0), y: number(value.y, 0) };
}

function size(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function marker(value: unknown): CanvasEdge["markerEnd"] {
  if (typeof value === "string") return value as MarkerType;
  if (!isRecord(value) || typeof value.type !== "string") return undefined;
  return {
    type: value.type as MarkerType,
    width: size(value.width),
    height: size(value.height),
    color: typeof value.color === "string" ? value.color : undefined,
  };
}

function edgeStyle(value: unknown): CanvasEdge["style"] {
  if (!isRecord(value)) return undefined;
  const style: Record<string, string | number> = {};
  if (typeof value.stroke === "string") style.stroke = value.stroke;
  if (typeof value.strokeWidth === "number") style.strokeWidth = value.strokeWidth;
  if (typeof value.strokeDasharray === "string") style.strokeDasharray = value.strokeDasharray;
  return Object.keys(style).length > 0 ? style : undefined;
}

function nodeData(
  type: NodeKind,
  value: unknown,
): TextData | ImageData | VideoData | GroupData {
  const data = isRecord(value) ? value : {};
  const generation = sanitizeGeneration(data.generation);
  switch (type) {
    case "text":
      return {
        title: text(data.title, "Text"),
        text: text(data.text),
        color: color(data.color),
        fontSize: Math.min(64, Math.max(10, number(data.fontSize, 16))),
        ...(generation ? { generation } : {}),
      };
    case "image":
      return {
        title: text(data.title, "Image"),
        src: sanitizeImageSrc(data.src),
        alt: text(data.alt),
        ...(generation ? { generation } : {}),
      };
    case "video":
      return {
        title: text(data.title, "Video"),
        src: sanitizeVideoSrc(data.src),
        thumbnailUrl: sanitizeImageSrc(data.thumbnailUrl),
        alt: text(data.alt),
        ...(generation ? { generation } : {}),
      };
    default:
      return {
        label: text(data.label, "Group"),
        color: color(data.color),
      };
  }
}

function sanitizeNode(value: unknown): CanvasNode | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) return null;
  const legacyNote = value.type === "note" || value.type === undefined;
  const type = legacyNote ? "text" : kind(value.type);
  const fallback = DEFAULT_SIZE[type];
  const width = size(value.width) ?? fallback.width;
  const height = size(value.height) ?? fallback.height;
  const rawData = legacyNote && isRecord(value.data)
    ? {
        title: text(value.data.title, "Text"),
        text: text(value.data.body),
        color: value.data.color,
        fontSize: 16,
      }
    : value.data;
  const base = {
    id: value.id,
    type,
    position: position(value.position),
    data: nodeData(type, rawData),
    selected: false,
    width,
    height,
    style: { width, height },
    ...(typeof value.parentId === "string" ? { parentId: value.parentId } : {}),
    ...(typeof value.zIndex === "number" && Number.isFinite(value.zIndex) ? { zIndex: value.zIndex } : {}),
  };
  return base as CanvasNode;
}

function sanitizeEdge(value: unknown): CanvasEdge | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    ...(typeof value.sourceHandle === "string" ? { sourceHandle: value.sourceHandle } : {}),
    ...(typeof value.targetHandle === "string" ? { targetHandle: value.targetHandle } : {}),
    ...(typeof value.type === "string" ? { type: value.type } : {}),
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(value.animated === true ? { animated: true } : {}),
    ...(edgeStyle(value.style) ? { style: edgeStyle(value.style) } : {}),
    ...(marker(value.markerEnd) ? { markerEnd: marker(value.markerEnd) } : {}),
    ...(marker(value.markerStart) ? { markerStart: marker(value.markerStart) } : {}),
  };
}

function sanitizeViewport(value: unknown): CanvasSnapshot["viewport"] {
  if (!isRecord(value)) return undefined;
  const zoom = number(value.zoom, 1);
  if (zoom <= 0 || zoom > MAX_ZOOM) return undefined;
  return { x: number(value.x, 0), y: number(value.y, 0), zoom };
}

/**
 * Validates and upgrades a snapshot to the current schema.
 * v1 had note nodes only and no explicit type; unknown fields are dropped.
 */
export function migrateSnapshot(input: unknown): CanvasSnapshot | null {
  if (!isRecord(input)) return null;
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return null;

  const version = typeof input.version === "number" ? input.version : 1;
  if (version > SCHEMA_VERSION) return null;

  const nodes = input.nodes.map(sanitizeNode).filter((node): node is CanvasNode => node !== null);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sanitized = nodes.map((node) =>
    node.parentId && !nodeIds.has(node.parentId) ? { ...node, parentId: undefined } : node,
  );
  const edges = input.edges
    .map(sanitizeEdge)
    .filter((edge): edge is CanvasEdge => edge !== null)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const viewport = sanitizeViewport(input.viewport);
  return { version: SCHEMA_VERSION, nodes: sanitized, edges, ...(viewport ? { viewport } : {}) };
}

/** Kept as the public name used by import/export code. */
export const parseSnapshot = migrateSnapshot;

export function loadSnapshot(): CanvasSnapshot | null {
  try {
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const snapshot = migrateSnapshot(JSON.parse(raw));
      if (!snapshot) continue;
      if (key !== STORAGE_KEY) {
        saveSnapshot(snapshot);
        localStorage.removeItem(key);
      }
      return snapshot;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveSnapshot(snapshot: CanvasSnapshot): void {
  try {
    const payload = {
      version: SCHEMA_VERSION,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      ...(snapshot.viewport ? { viewport: snapshot.viewport } : {}),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 不可用（隐私模式/配额满）时静默降级，不影响画布编辑。
  }
}

export async function exportSnapshot(snapshot: CanvasSnapshot): Promise<void> {
  let nodes = snapshot.nodes;
  if (nodes.some((node) => node.type === "image" && isIdbImageRef(node.data.src))) {
    nodes = await Promise.all(
      nodes.map(async (node) => {
        if (node.type !== "image" || !isIdbImageRef(node.data.src)) return node;
        const image = await getImageBlob(node.data.src);
        if (!image) return node;
        try {
          const src = await blobToDataUrl(image);
          return { ...node, data: { ...node.data, src } } as CanvasNode;
        } catch {
          return node;
        }
      }),
    );
  }

  const payload = {
    version: SCHEMA_VERSION,
    nodes,
    edges: snapshot.edges,
    ...(snapshot.viewport ? { viewport: snapshot.viewport } : {}),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `infinite-canvas-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
