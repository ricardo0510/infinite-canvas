import type { CanvasSnapshot } from "../types";

const STORAGE_KEY = "infinite-canvas:v1";

type StoredSnapshot = CanvasSnapshot & { version?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSnapshot(value: unknown): CanvasSnapshot | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;

  return {
    nodes: value.nodes.filter(
      (node): node is CanvasSnapshot["nodes"][number] =>
        isRecord(node) && typeof node.id === "string" && isRecord(node.position) && isRecord(node.data),
    ),
    edges: value.edges.filter(
      (edge): edge is CanvasSnapshot["edges"][number] =>
        isRecord(edge) && typeof edge.id === "string" && typeof edge.source === "string" && typeof edge.target === "string",
    ),
  };
}

export function loadSnapshot(): CanvasSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: CanvasSnapshot): void {
  try {
    const payload: StoredSnapshot = { version: 1, nodes: snapshot.nodes, edges: snapshot.edges };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 不可用（隐私模式/配额满）时静默降级，不影响画布。
  }
}

export function exportSnapshot(snapshot: CanvasSnapshot): void {
  const payload: StoredSnapshot = { version: 1, nodes: snapshot.nodes, edges: snapshot.edges };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `infinite-canvas-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
