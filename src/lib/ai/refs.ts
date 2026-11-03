import type { CanvasEdge, CanvasNode, GenerationKind } from "../../types";
import type { ReferenceInput, UpstreamReference } from "./types";

type ActiveResult = {
  kind?: string;
  url?: string;
  text?: string;
  thumbnailUrl?: string;
};

function activeResult(node: CanvasNode): ActiveResult | undefined {
  const generation = (node.data as { generation?: { results?: unknown[]; activeResultId?: string } }).generation;
  if (!generation || !Array.isArray(generation.results)) return undefined;
  return (
    generation.results.find((item) => (item as { id?: string }).id === generation.activeResultId) ??
    generation.results[0]
  ) as ActiveResult | undefined;
}

function textOf(node: CanvasNode): string {
  if (node.type !== "text") return "";
  const body = typeof node.data.text === "string" ? node.data.text : "";
  if (body.trim()) return body.trim();
  const result = activeResult(node);
  return result?.kind === "text" && result.text ? result.text.trim() : "";
}

function imageOf(node: CanvasNode): string {
  if (node.type !== "image") return "";
  const src = typeof node.data.src === "string" ? node.data.src : "";
  if (src) return src;
  const result = activeResult(node);
  return result?.kind === "image" && result.url ? result.url : "";
}

function videoOf(node: CanvasNode): string {
  if (node.type !== "video") return "";
  const src = typeof node.data.src === "string" ? node.data.src : "";
  if (src) return src;
  const result = activeResult(node);
  return result?.kind === "video" && result.url ? result.url : "";
}

function audioOf(node: CanvasNode): string {
  if (node.type !== "audio") return "";
  const src = typeof node.data.src === "string" ? node.data.src : "";
  if (src) return src;
  const result = activeResult(node);
  return result?.kind === "audio" && result.url ? result.url : "";
}

export function collectUpstream(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): { texts: string[]; references: UpstreamReference[] } {
  const index = new Map(nodes.map((node) => [node.id, node]));
  const sourceIds = edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
  const texts: string[] = [];
  const references: UpstreamReference[] = [];
  const seenTexts = new Set<string>();
  const seenUrls = new Set<string>();

  for (const sourceId of sourceIds) {
    const source = index.get(sourceId);
    if (!source) continue;
    const body = textOf(source);
    if (body && !seenTexts.has(body)) {
      seenTexts.add(body);
      texts.push(body);
    }
    const image = imageOf(source);
    if (image && !seenUrls.has(image)) {
      seenUrls.add(image);
      references.push({ kind: "image", url: image });
    }
    const video = videoOf(source);
    if (video && !seenUrls.has(video)) {
      seenUrls.add(video);
      references.push({ kind: "video", url: video });
    }
  }

  return { texts, references };
}

export type NodePreview = {
  kind: "text" | "image" | "video" | "audio";
  title: string;
  url?: string;
  poster?: string;
  text?: string;
  duration?: number;
};

function previewTitle(node: CanvasNode): string {
  const title = typeof node.data.title === "string" ? node.data.title.trim() : "";
  if (title) return title;
  if (node.type === "image") return "图片";
  if (node.type === "video") return "视频";
  if (node.type === "audio") return "音频";
  return "文本";
}

/** Immediate upstream nodes that feed generated content into `nodeId`. */
export function upstreamSourceNodes(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): CanvasNode[] {
  const index = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const result: CanvasNode[] = [];
  for (const edge of edges) {
    if (edge.target !== nodeId || seen.has(edge.source)) continue;
    const source = index.get(edge.source);
    if (!source || source.type === "group") continue;
    seen.add(edge.source);
    result.push(source);
  }
  return result;
}

export function previewOf(node: CanvasNode): NodePreview | null {
  const title = previewTitle(node);
  if (node.type === "text") {
    return { kind: "text", title, text: textOf(node) };
  }
  if (node.type === "image") {
    return { kind: "image", title, url: imageOf(node) };
  }
  if (node.type === "video") {
    const result = activeResult(node);
    const dataThumb = typeof node.data.thumbnailUrl === "string" ? node.data.thumbnailUrl : "";
    const resultThumb = result?.kind === "video" ? (result.thumbnailUrl ?? "") : "";
    return {
      kind: "video",
      title,
      url: videoOf(node),
      poster: dataThumb || resultThumb,
    };
  }
  if (node.type === "audio") {
    const duration = typeof node.data.duration === "number" ? node.data.duration : 0;
    return { kind: "audio", title, url: audioOf(node), duration };
  }
  return null;
}

export function composePrompt(prompt: string, texts: string[]): string {
  const own = prompt.trim();
  if (texts.length === 0) return own;
  const context = texts.join("\n");
  return own ? `${own}\n\n--- 上游文本 ---\n${context}` : context;
}

export function mapUpstreamReferences(
  kind: GenerationKind,
  mode: string | undefined,
  upstream: UpstreamReference[],
): ReferenceInput[] {
  if (kind === "text") return [];
  if (kind === "audio") return [];
  const images = upstream.filter((item) => item.kind === "image").slice(0, 8);
  const videos = upstream.filter((item) => item.kind === "video").slice(0, 3);

  if (kind === "image") {
    return images.map((item) => ({ type: "reference", url: item.url }));
  }

  if (videos.length > 0) {
    return [
      ...videos.map((item): ReferenceInput => ({ type: "referenceVideo", url: item.url })),
      ...images.map((item): ReferenceInput => ({ type: "referenceImage", url: item.url })),
    ];
  }

  if (mode === "firstLastFrame" && images.length >= 2) {
    return [
      { type: "firstFrame", url: images[0].url },
      { type: "lastFrame", url: images[1].url },
    ];
  }

  return images.map((item): ReferenceInput => ({ type: "referenceImage", url: item.url }));
}
