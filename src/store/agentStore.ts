import { create } from "zustand";
import { MOCK_MODEL_ID } from "../lib/ai/agent/client";
import type {
  AgentMessage,
  AgentPlanStatus,
  AgentStatus,
  AiCommandPlan,
} from "../lib/ai/agent/types";

const STORAGE_KEY = "infinite-canvas:ai-agent:v1";
const MESSAGE_LIMIT = 50;
const PLAN_STATUSES = new Set<AgentPlanStatus>([
  "pending",
  "executing",
  "done",
  "failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlan(value: unknown): value is AiCommandPlan {
  if (!isRecord(value)) return false;
  if (typeof value.summary !== "string") return false;
  if (!Array.isArray(value.commands)) return false;
  if (!value.commands.every((command) => isRecord(command) && typeof command.op === "string")) {
    return false;
  }
  return value.clarification === undefined || typeof value.clarification === "string";
}

type PersistedSession = {
  messages: AgentMessage[];
  modelId: string;
};

type AgentState = {
  messages: AgentMessage[];
  status: AgentStatus;
  modelId: string;
  addMessage: (message: AgentMessage) => void;
  updateMessage: (id: string, patch: Partial<AgentMessage>) => void;
  clear: () => void;
  setModelId: (id: string) => void;
  setStatus: (status: AgentStatus) => void;
};

function isMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.role !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.content !== "string" ||
    typeof value.createdAt !== "number"
  ) {
    return false;
  }
  if (value.plan !== undefined && !isPlan(value.plan)) return false;
  if (
    value.planStatus !== undefined &&
    (typeof value.planStatus !== "string" ||
      !PLAN_STATUSES.has(value.planStatus as AgentPlanStatus))
  ) {
    return false;
  }
  if (
    value.affectedNodeIds !== undefined &&
    (!Array.isArray(value.affectedNodeIds) ||
      !value.affectedNodeIds.every((id) => typeof id === "string"))
  ) {
    return false;
  }
  if (value.undone !== undefined && typeof value.undone !== "boolean") return false;
  if (
    value.historyRevision !== undefined &&
    (typeof value.historyRevision !== "number" || !Number.isFinite(value.historyRevision))
  ) {
    return false;
  }
  return true;
}

function loadSession(): PersistedSession {
  const fallback: PersistedSession = { messages: [], modelId: MOCK_MODEL_ID };
  if (typeof sessionStorage === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter(isMessage)
          .slice(-MESSAGE_LIMIT)
          // A reload interrupts execution, so never restore a stuck "executing" card.
          .map((message) =>
            message.planStatus === "executing"
              ? { ...message, planStatus: "failed" as const }
              : message,
          )
      : [];
    return {
      messages,
      modelId: typeof parsed.modelId === "string" ? parsed.modelId : MOCK_MODEL_ID,
    };
  } catch {
    return fallback;
  }
}

function saveSession(messages: AgentMessage[], modelId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const persisted: PersistedSession = {
      messages: messages.slice(-MESSAGE_LIMIT),
      modelId,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Session storage can be unavailable in hardened browsers.
  }
}

function newMessageId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `agent-${uuid}`;
}

export function createAgentMessage(
  input: Omit<AgentMessage, "id" | "createdAt">,
): AgentMessage {
  return { ...input, id: newMessageId(), createdAt: Date.now() };
}

const initial = loadSession();

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: initial.messages,
  status: "idle",
  modelId: initial.modelId,
  addMessage: (message) => {
    const messages = [...get().messages, message].slice(-MESSAGE_LIMIT);
    set({ messages });
    saveSession(messages, get().modelId);
  },
  updateMessage: (id, patch) => {
    const messages = get().messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    );
    set({ messages });
    saveSession(messages, get().modelId);
  },
  clear: () => {
    set({ messages: [], status: "idle" });
    saveSession([], get().modelId);
  },
  setModelId: (modelId) => {
    set({ modelId });
    saveSession(get().messages, modelId);
  },
  setStatus: (status) => set({ status }),
}));
