import { aiRequest } from "../http";
import type { AgentChatRequest, AgentChatResponse } from "./types";

export const MOCK_MODEL_ID = "mock";

export const AGENT_TIMEOUT_MS = 45_000;

export async function requestAgentChat(
  request: AgentChatRequest,
  signal?: AbortSignal,
): Promise<AgentChatResponse> {
  return aiRequest<AgentChatResponse>("/agent/chat", {
    method: "POST",
    body: request,
    timeout: AGENT_TIMEOUT_MS,
    ...(signal ? { signal } : {}),
  });
}
