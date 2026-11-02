import type { Viewport } from "@xyflow/react";
import { nodeRect, byId } from "../../geometry";
import type { CanvasEdge, CanvasNode } from "../../../types";
import { MAX_NODES } from "./tools";
import type {
  AgentChatMessage,
  AgentContext,
  AgentContextEdge,
  AgentContextGroup,
  AgentContextNode,
  AgentMessage,
} from "./types";

const TEXT_LIMIT = 120;
const SELECTED_TEXT_LIMIT = 2000;

function nodeTitle(node: CanvasNode): string {
  if (node.type === "group") return node.data.label || "分组";
  if (node.data.title) return node.data.title;
  if (node.type === "text") return "文本";
  return node.type === "image" ? "图片" : "视频";
}

function nodeText(node: CanvasNode, limit: number): string {
  if (node.type === "text") return (node.data.text ?? "").slice(0, limit);
  if (node.type === "image") return (node.data.alt ?? "").slice(0, limit);
  if (node.type === "video") return (node.data.alt ?? "").slice(0, limit);
  return "";
}

function toContextNode(
  node: CanvasNode,
  full: boolean,
  index: Map<string, CanvasNode>,
): AgentContextNode {
  if (!full) {
    return {
      id: node.id,
      type: node.type ?? "text",
      title: nodeTitle(node),
      text: nodeText(node, TEXT_LIMIT),
      parentId: node.parentId ?? null,
    };
  }
  const rect = nodeRect(node, index);
  return {
    id: node.id,
    type: node.type ?? "text",
    title: nodeTitle(node),
    text: nodeText(node, SELECTED_TEXT_LIMIT),
    parentId: node.parentId ?? null,
    x: Math.round(node.position.x),
    y: Math.round(node.position.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function selectedFirst(nodes: CanvasNode[]): CanvasNode[] {
  const selected = nodes.filter((node) => node.selected);
  const groups = nodes.filter((node) => !node.selected && node.type === "group");
  const rest = nodes.filter((node) => !node.selected && node.type !== "group");
  return [...selected, ...groups, ...rest];
}

export function buildAgentContext(input: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport | null;
}): AgentContext {
  const { nodes, edges, viewport } = input;
  const ordered = selectedFirst(nodes).slice(0, MAX_NODES);
  const included = new Set(ordered.map((node) => node.id));
  const index = byId(nodes);
  const contextNodes = ordered.map((node) =>
    toContextNode(node, node.selected === true, index),
  );
  const groups: AgentContextGroup[] = nodes
    .filter((node) => node.type === "group")
    .map((node) => ({
      id: node.id,
      label: node.data.label || "分组",
      parentId: node.parentId ?? null,
    }));
  const contextEdges: AgentContextEdge[] = edges
    .filter((edge) => included.has(edge.source) && included.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label !== undefined && edge.label !== null
        ? { label: String(edge.label) }
        : {}),
    }));

  return {
    selectedNodeIds: nodes.filter((node) => node.selected).map((node) => node.id),
    nodes: contextNodes,
    edges: contextEdges,
    groups,
    viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
    totalNodes: nodes.length,
    truncated: nodes.length > MAX_NODES,
  };
}

const MESSAGE_LIMIT = 12;
const MESSAGE_CHAR_LIMIT = 2000;

export function buildChatMessages(messages: AgentMessage[]): AgentChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => message.kind !== "plan" || message.role === "assistant")
    .slice(-MESSAGE_LIMIT)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content.slice(0, MESSAGE_CHAR_LIMIT),
    }));
}

export function contextSummary(context: AgentContext): string {
  const selected = context.selectedNodeIds.length;
  const groups = context.groups.length;
  return [`共 ${context.totalNodes} 个节点`, `选中 ${selected} 个`, `分组 ${groups} 个`]
    .filter(Boolean)
    .join(" · ");
}
