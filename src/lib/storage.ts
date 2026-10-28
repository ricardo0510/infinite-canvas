import type { MarkerType } from "@xyflow/react";
import { DEFAULT_SIZE } from "./geometry";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasSnapshot,
  GroupData,
  ImageData,
  NodeKind,
  NoteColor,
  NoteData,
  TextData,
} from "../types";

export const SCHEMA_VERSION = 2;

const STORAGE_KEY = "infinite-canvas:v2";
const LEGACY_KEYS = ["infinite-canvas:v1"];
const MAX_ZOOM = 8;

const NODE_KINDS: NodeKind[] = ["note", "text", "image", "group"];
const COLORS: NoteColor[] = ["violet", "cyan", "amber", "emerald"];

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

function color(value: unknown): NoteColor {
  return COLORS.includes(value as NoteColor) ? (value as NoteColor) : "violet";
}

function kind(value: unknown): NodeKind {
  return NODE_KINDS.includes(value as NodeKind) ? (value as NodeKind) : "note";
}

/** Only local, uploaded, or https images are allowed. */
export function sanitizeImageSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const src = value.trim();
  if (/^https:\/\//i.test(src)) return src;
  if (/^blob:/i.test(src)) return src;
  if (/^data:image\//i.test(src)) return src;
  return "";
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

function nodeData(type: NodeKind, value: unknown): NoteData | TextData | ImageData | GroupData {
  const data = isRecord(value) ? value : {};
  switch (type) {
    case "text":
      return {
        text: text(data.text),
        color: color(data.color),
        fontSize: Math.min(64, Math.max(10, number(data.fontSize, 16))),
      };
    case "image":
      return {
        src: sanitizeImageSrc(data.src),
        alt: text(data.alt),
      };
    case "group":
      return {
        label: text(data.label, "Group"),
        color: color(data.color),
      };
    default:
      return {
        title: text(data.title, "Untitled note"),
        body: text(data.body),
        color: color(data.color),
      };
  }
}

function sanitizeNode(value: unknown): CanvasNode | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) return null;
  const type = kind(value.type);
  const fallback = DEFAULT_SIZE[type];
  const width = size(value.width) ?? fallback.width;
  const height = size(value.height) ?? fallback.height;
  const base = {
    id: value.id,
    type,
    position: position(value.position),
    data: nodeData(type, value.data),
    selected: false,
    width,
    height,
    style: { width, height },
    ...(typeof value.parentId === "string" ? { parentId: value.parentId } : {}),
    ...(value.extent === "parent" ? { extent: "parent" as const } : {}),
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

export function exportSnapshot(snapshot: CanvasSnapshot): void {
  const payload = {
    version: SCHEMA_VERSION,
    nodes: snapshot.nodes,
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
