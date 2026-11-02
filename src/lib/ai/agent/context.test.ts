import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../../../types";
import { buildAgentContext, buildChatMessages } from "./context";
import type { AgentMessage } from "./types";

function textNode(id: string, selected = false, text = ""): CanvasNode {
  return {
    id,
    type: "text",
    position: { x: 10, y: 20 },
    width: 280,
    height: 160,
    selected,
    data: { title: id, text, color: "emerald", fontSize: 14 },
  };
}

describe("buildAgentContext", () => {
  it("puts selected nodes first and sends their full fields", () => {
    const context = buildAgentContext({
      nodes: [textNode("a"), textNode("b", true, "hello")],
      edges: [],
      viewport: { x: 1, y: 2, zoom: 0.5 },
    });
    expect(context.nodes[0].id).toBe("b");
    expect(context.nodes[0]).toMatchObject({ x: 10, y: 20, width: 280, height: 160 });
    expect(context.selectedNodeIds).toEqual(["b"]);
    expect(context.viewport).toEqual({ x: 1, y: 2, zoom: 0.5 });
  });

  it("truncates non-selected text and caps node count", () => {
    const nodes = Array.from({ length: 205 }, (_item, index) =>
      textNode(`n-${index}`, index === 204, "x".repeat(300)),
    );
    const context = buildAgentContext({ nodes, edges: [], viewport: null });
    expect(context.truncated).toBe(true);
    expect(context.nodes).toHaveLength(200);
    expect(context.nodes[0].id).toBe("n-204");
    expect(context.nodes[1].text).toHaveLength(120);
  });

  it("keeps group metadata and only edges between included nodes", () => {
    const group: CanvasNode = {
      id: "g",
      type: "group",
      position: { x: 0, y: 0 },
      data: { label: "分组", color: "amber" },
    };
    const context = buildAgentContext({
      nodes: [group, textNode("a")],
      edges: [
        { id: "e1", source: "a", target: "g" },
        { id: "e2", source: "a", target: "missing" },
      ],
      viewport: null,
    });
    expect(context.groups).toEqual([{ id: "g", label: "分组", parentId: null }]);
    expect(context.edges.map((edge) => edge.id)).toEqual(["e1"]);
  });
});

describe("buildChatMessages", () => {
  it("keeps the last 12 messages and truncates long content", () => {
    const messages: AgentMessage[] = Array.from({ length: 15 }, (_item, index) => ({
      id: `m-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      kind: "text",
      content: `message ${index} ${"x".repeat(2500)}`,
      createdAt: index,
    }));
    const result = buildChatMessages(messages);
    expect(result).toHaveLength(12);
    expect(result[0].content.startsWith("message 3")).toBe(true);
    expect(result[11].content.length).toBe(2000);
  });
});
