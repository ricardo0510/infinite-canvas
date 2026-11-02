import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { ProviderCatalogService } from "../byok/provider-catalog.service";
import type { CredentialsService } from "../byok/credentials.service";
import type { ProviderAdapter } from "../providers/provider-adapter";
import type { ProviderRegistry } from "../providers/provider-registry.service";
import { AgentService } from "./agent.service";
import { parseAgentOutput } from "./agent.prompt";
import type { AgentChatDto } from "./dto/agent-chat.dto";

const dto: AgentChatDto = {
  modelId: "test:text-model",
  messages: [{ role: "user", content: "把选中的节点整理成横向流程图" }],
  context: {
    selectedNodeIds: ["a", "b"],
    nodes: [
      { id: "a", type: "text", title: "开始", text: "", parentId: null },
      { id: "b", type: "text", title: "结束", text: "", parentId: null },
    ],
    edges: [{ id: "e1", source: "a", target: "b" }],
    groups: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    totalNodes: 2,
    truncated: false,
  },
};

function createService(text: string) {
  const generateText = vi.fn(
    async (_ctx: unknown, _input: { systemPrompt?: string; prompt: string }) => ({ text }),
  );
  const adapter = {
    listModels: vi.fn(async () => []),
    testKey: vi.fn(async () => ({ ok: true })),
    generateText,
  } as unknown as ProviderAdapter;
  const catalog = {
    resolveGenerationModel: vi.fn(async () => ({
      model: {
        id: "test:text-model",
        name: "测试模型",
        kind: "text",
        modes: [],
        limits: { maxPromptLength: 8000, maxImages: 0, maxVideos: 0 },
        output: { image: null, video: null },
      },
      providerId: "test",
      providerModel: "text-model",
      credentialId: "cred-1",
    })),
  } as unknown as ProviderCatalogService;
  const credentials = {
    resolve: vi.fn(async () => ({
      credentialId: "cred-1",
      apiKey: "sk-test",
      provider: {
        id: "test",
        name: "测试",
        adapter: "openai-compatible",
        authType: "bearer",
        baseUrl: "https://example.com/v1",
        timeoutMs: 1000,
        extra: null,
      },
    })),
    touch: vi.fn(async () => undefined),
    markInvalid: vi.fn(async () => undefined),
  } as unknown as CredentialsService;
  const registry = {
    get: vi.fn(() => adapter),
  } as unknown as ProviderRegistry;
  return {
    service: new AgentService(catalog, credentials, registry),
    generateText,
  };
}

describe("parseAgentOutput", () => {
  it("parses a fenced plan", () => {
    const result = parseAgentOutput(
      '```json\n{"kind":"plan","message":"ok","summary":"整理","commands":[{"op":"autoLayout"}]}\n```',
    );
    expect(result).toEqual({
      kind: "plan",
      message: "ok",
      summary: "整理",
      commands: [{ op: "autoLayout" }],
    });
  });

  it("falls back to a reply for non-JSON text", () => {
    const result = parseAgentOutput("我现在不能这样做");
    expect(result).toEqual({ kind: "reply", message: "我现在不能这样做" });
  });

  it("rejects plans with unknown tools", () => {
    const result = parseAgentOutput(
      '{"kind":"plan","message":"ok","summary":"x","commands":[{"op":"exec"}]}',
    );
    expect(result.kind).toBe("reply");
  });

  it("parses clarifications", () => {
    const result = parseAgentOutput(
      '{"kind":"clarify","message":"你指的是哪些节点？","clarification":"请补充"}',
    );
    expect(result).toEqual({
      kind: "clarify",
      message: "你指的是哪些节点？",
      clarification: "请补充",
    });
  });
});

describe("AgentService", () => {
  it("calls the text adapter and returns a plan", async () => {
    const { service, generateText } = createService(
      '{"kind":"plan","message":"我准备整理","summary":"整理节点","commands":[{"op":"autoLayout"}]}',
    );
    const result = await service.chat("user-1", dto);
    expect(result.kind).toBe("plan");
    expect(generateText).toHaveBeenCalledOnce();
    const input = generateText.mock.calls[0][1] as {
      systemPrompt?: string;
      prompt: string;
    };
    expect(input.systemPrompt).toContain("白名单工具");
    expect(input.prompt).toContain("把选中的节点整理成横向流程图");
  });
});
