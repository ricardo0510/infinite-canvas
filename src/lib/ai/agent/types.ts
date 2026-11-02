import type { NoteColor } from "../../../types";

export type AgentMessageKind =
  | "text"
  | "plan"
  | "clarification"
  | "execution"
  | "error";

export type AgentPlanStatus = "pending" | "executing" | "done" | "failed";

export type AiCommandNodeRef = { id: string } | { alias: string };

export type AiCommand =
  | { op: "select"; nodeIds: string[] }
  | { op: "focus"; nodeIds: string[] }
  | {
      op: "addNode";
      alias?: string;
      kind: "text" | "image" | "video";
      title?: string;
      text?: string;
    }
  | {
      op: "updateNode";
      node: AiCommandNodeRef;
      patch: {
        title?: string;
        text?: string;
        color?: NoteColor;
      };
    }
  | { op: "connect"; from: AiCommandNodeRef; to: AiCommandNodeRef }
  | { op: "group"; nodeIds: string[]; label?: string }
  | { op: "ungroup"; nodeId: string }
  | {
      op: "align";
      nodeIds: string[];
      kind: "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
    }
  | { op: "distribute"; nodeIds: string[]; axis: "x" | "y" }
  | { op: "autoLayout" }
  | { op: "delete"; nodeIds: string[] }
  | { op: "template"; templateId: string; anchor?: { x: number; y: number } };

export type AiCommandPlan = {
  summary: string;
  commands: AiCommand[];
  clarification?: string;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  kind: AgentMessageKind;
  content: string;
  createdAt: number;
  plan?: AiCommandPlan;
  planStatus?: AgentPlanStatus;
  affectedNodeIds?: string[];
  undone?: boolean;
};

export type AgentContextNode = {
  id: string;
  type: string;
  title: string;
  text: string;
  parentId: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type AgentContextEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type AgentContextGroup = {
  id: string;
  label: string;
  parentId: string | null;
};

export type AgentContext = {
  selectedNodeIds: string[];
  nodes: AgentContextNode[];
  edges: AgentContextEdge[];
  groups: AgentContextGroup[];
  viewport: { x: number; y: number; zoom: number };
  totalNodes: number;
  truncated: boolean;
};

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatRequest = {
  modelId: string;
  messages: AgentChatMessage[];
  context: AgentContext;
};

export type AgentChatResponse =
  | { kind: "reply"; message: string }
  | { kind: "clarify"; message: string; clarification?: string }
  | {
      kind: "plan";
      message: string;
      summary: string;
      commands: AiCommand[];
      clarification?: string;
    };

export type AgentStatus = "idle" | "planning" | "executing";
