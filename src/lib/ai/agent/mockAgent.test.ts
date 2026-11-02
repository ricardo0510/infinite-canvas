import { describe, expect, it } from "vitest";
import { runMockAgent } from "./mockAgent";
import type { AgentContext, AgentContextNode } from "./types";

function node(id: string, text: string, type = "text"): AgentContextNode {
  return { id, type, title: id, text, parentId: null, x: 0, y: 0 };
}

function context(nodes: AgentContextNode[], selectedNodeIds: string[] = []): AgentContext {
  return {
    selectedNodeIds,
    nodes,
    edges: [],
    groups: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    totalNodes: nodes.length,
    truncated: false,
  };
}

describe("runMockAgent", () => {
  it("turns a flowchart request into align + autoLayout", () => {
    const response = runMockAgent(
      "把选中的节点整理成横向流程图",
      context([node("a", "x"), node("b", "y")], ["a", "b"]),
    );
    expect(response.kind).toBe("plan");
    if (response.kind === "plan") {
      expect(response.commands.map((command) => command.op)).toEqual([
        "align",
        "autoLayout",
        "select",
      ]);
    }
  });

  it("finds and deletes empty text nodes", () => {
    const response = runMockAgent(
      "删除空文本节点",
      context([node("a", ""), node("b", "有内容")]),
    );
    expect(response.kind).toBe("plan");
    if (response.kind === "plan") {
      expect(response.commands[0]).toEqual({ op: "delete", nodeIds: ["a"] });
    }
  });

  it("answers what-is-in-this-group questions instead of proposing a group action", () => {
    const group: AgentContextNode = {
      id: "g",
      type: "group",
      title: "g",
      text: "",
      parentId: null,
    };
    const child: AgentContextNode = {
      id: "a",
      type: "text",
      title: "卡片",
      text: "",
      parentId: "g",
    };
    const response = runMockAgent(
      "这个分组里有什么？",
      context([group, child], ["g"]),
    );
    expect(response.kind).toBe("reply");
    if (response.kind === "reply") expect(response.message).toContain("卡片");
  });

  it("answers count questions without a plan", () => {
    const response = runMockAgent(
      "这个画布有几个空文本节点？",
      context([node("a", ""), node("b", "有内容")]),
    );
    expect(response.kind).toBe("reply");
    if (response.kind === "reply") expect(response.message).toContain("1");
  });

  it("asks for clarification when nothing is selected", () => {
    const response = runMockAgent("把它们删掉", context([node("a", "x")]));
    expect(response.kind).toBe("clarify");
  });

  it("creates the requested number of text nodes", () => {
    const response = runMockAgent("新建3个文本节点", context([]));
    expect(response.kind).toBe("plan");
    if (response.kind === "plan") {
      expect(response.commands).toHaveLength(3);
      expect(response.commands[0]).toMatchObject({ op: "addNode", kind: "text" });
    }
  });

  it("inserts the kanban template", () => {
    const response = runMockAgent("新建一个三列看板", context([]));
    expect(response.kind).toBe("plan");
    if (response.kind === "plan") {
      expect(response.commands[0]).toEqual({ op: "template", templateId: "kanban" });
    }
  });
});
