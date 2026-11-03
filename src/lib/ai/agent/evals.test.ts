import { describe, expect, it } from "vitest";
import { AGENT_EVALS } from "./evals";
import { runMockAgent } from "./mockAgent";
import type { AgentContext } from "./types";

function contextFor(item: (typeof AGENT_EVALS)[number]): AgentContext {
  return {
    selectedNodeIds: item.selected,
    nodes: item.nodes,
    edges: [],
    groups: item.nodes
      .filter((node) => node.type === "group")
      .map((node) => ({ id: node.id, label: node.title, parentId: node.parentId })),
    viewport: { x: 0, y: 0, zoom: 1 },
    totalNodes: item.nodes.length,
    truncated: false,
  };
}

describe("mock agent eval set", () => {
  it.each(AGENT_EVALS)("$id: $input", (item) => {
    const response = runMockAgent(item.input, contextFor(item));
    expect(response.kind).toBe(item.expect.kind);

    if (response.kind === "plan" && item.expect.ops) {
      expect(response.commands.map((command) => command.op)).toEqual(item.expect.ops);
    }

    if (item.expect.messageIncludes) {
      expect(response.message).toContain(item.expect.messageIncludes);
    }
  });
});
