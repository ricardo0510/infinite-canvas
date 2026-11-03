import { describe, expect, it } from "vitest";
import { buildAgentUserPrompt } from "./agent.prompt";
import type { AgentChatDto } from "./dto/agent-chat.dto";

function hugeDto(): AgentChatDto {
  const nodes = Array.from({ length: 200 }, (_item, index) => ({
    id: `n-${index}`,
    type: "text",
    title: `节点 ${index}`,
    text: "字".repeat(2000),
    parentId: null,
    x: index * 10,
    y: index * 10,
  }));
  const messages = Array.from({ length: 12 }, (_item, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `历史消息 ${index}：${"x".repeat(2000)}`,
  }));
  messages[messages.length - 1] = {
    role: "user",
    content: "最后的问题：把选中的节点左对齐",
  };
  return {
    modelId: "test:text-model",
    messages,
    context: {
      selectedNodeIds: ["n-0", "n-1"],
      nodes,
      edges: [],
      groups: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      totalNodes: 200,
      truncated: false,
    },
  };
}

describe("buildAgentUserPrompt", () => {
  it("keeps the latest user message when the context is huge", () => {
    const prompt = buildAgentUserPrompt(hugeDto());

    expect(prompt.length).toBeLessThanOrEqual(60_000);
    expect(prompt).toContain("最后的问题：把选中的节点左对齐");
    expect(prompt.endsWith("输出约定格式的 JSON。")).toBe(true);
    expect(prompt).toContain("上下文已截断");
  });

  it("keeps short conversations intact", () => {
    const prompt = buildAgentUserPrompt({
      modelId: "test:text-model",
      messages: [
        { role: "user", content: "先选中两个节点" },
        { role: "assistant", content: "已选中。" },
        { role: "user", content: "把它们左对齐" },
      ],
      context: {
        selectedNodeIds: ["a", "b"],
        nodes: [
          { id: "a", type: "text", title: "A", text: "", parentId: null },
          { id: "b", type: "text", title: "B", text: "", parentId: null },
        ],
        edges: [],
        groups: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        totalNodes: 2,
        truncated: false,
      },
    });

    expect(prompt).toContain("用户：把它们左对齐");
    expect(prompt).toContain("助手：已选中。");
    expect(prompt).not.toContain("上下文已截断");
  });
});
