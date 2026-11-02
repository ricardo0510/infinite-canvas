import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../../store/canvasStore";
import type { CanvasNode } from "../../../types";
import { executePlan, PlanExecutionError } from "./executor";

function reset(nodes: CanvasNode[] = []) {
  useCanvasStore.setState({
    nodes,
    edges: [],
    past: [],
    future: [],
    clipboard: null,
    viewport: null,
    batching: false,
  });
}

function textNode(id: string, x = 0, y = 0): CanvasNode {
  return {
    id,
    type: "text",
    position: { x, y },
    width: 280,
    height: 160,
    data: { title: id, text: "", color: "emerald", fontSize: 14 },
  };
}

beforeEach(() => reset());

describe("executePlan", () => {
  it("creates aliased nodes, connects them, and records one history entry", async () => {
    const result = await executePlan({
      summary: "新建并连接",
      commands: [
        { op: "addNode", alias: "a", kind: "text", title: "开始" },
        { op: "addNode", alias: "b", kind: "text", title: "结束" },
        { op: "connect", from: { alias: "a" }, to: { alias: "b" } },
      ],
    });

    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0].data).toMatchObject({ title: "开始" });
    expect(state.edges).toHaveLength(1);
    expect(state.past).toHaveLength(1);
    expect(result.affectedNodeIds).toHaveLength(2);
    expect(state.nodes.every((node) => node.selected)).toBe(true);

    state.undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it("updates an aliased node", async () => {
    const result = await executePlan({
      summary: "新建并改名",
      commands: [
        { op: "addNode", alias: "a", kind: "text", title: "旧标题" },
        { op: "updateNode", node: { alias: "a" }, patch: { title: "新标题" } },
      ],
    });
    const node = useCanvasStore
      .getState()
      .nodes.find((item) => item.id === result.affectedNodeIds[0]);
    expect(node?.data).toMatchObject({ title: "新标题" });
  });

  it("rejects an invalid plan before touching the canvas", async () => {
    useCanvasStore.setState({ nodes: [textNode("a")] });
    await expect(
      executePlan({ summary: "坏计划", commands: [{ op: "delete", nodeIds: ["missing"] }] }),
    ).rejects.toBeInstanceOf(PlanExecutionError);
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
    expect(useCanvasStore.getState().past).toHaveLength(0);
  });

  it("restores the canvas when a batch throws", async () => {
    const store = useCanvasStore.getState();
    await expect(
      store.runBatch(async () => {
        useCanvasStore.getState().addNode("text", { x: 0, y: 0 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(useCanvasStore.getState().past).toHaveLength(0);
    expect(useCanvasStore.getState().batching).toBe(false);
  });

  it("inserts a template in one batch", async () => {
    const result = await executePlan({
      summary: "看板",
      commands: [{ op: "template", templateId: "kanban", anchor: { x: 0, y: 0 } }],
    });
    expect(useCanvasStore.getState().nodes).toHaveLength(3);
    expect(result.affectedNodeIds).toHaveLength(3);
    expect(useCanvasStore.getState().past).toHaveLength(1);
  });

  it("deletes selected nodes in one batch", async () => {
    useCanvasStore.setState({ nodes: [textNode("a"), textNode("b", 400, 0)] });
    await executePlan({
      summary: "删除",
      commands: [{ op: "delete", nodeIds: ["a"] }],
    });
    expect(useCanvasStore.getState().nodes.map((node) => node.id)).toEqual(["b"]);
    expect(useCanvasStore.getState().past).toHaveLength(1);
  });
});
