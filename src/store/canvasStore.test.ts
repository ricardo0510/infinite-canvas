import { beforeEach, describe, expect, it } from "vitest";
import { MarkerType } from "@xyflow/react";
import { useCanvasStore } from "./canvasStore";
import type { CanvasNode, CanvasEdge } from "../types";

function reset(nodes: CanvasNode[] = [], edges: CanvasEdge[] = []) {
  useCanvasStore.setState({ nodes, edges, past: [], future: [], clipboard: null, viewport: null });
}

function add(kind: "note" | "text" | "image", x: number, y: number) {
  return useCanvasStore.getState().addNode(kind, { x, y });
}

function node(id: string): CanvasNode {
  const found = useCanvasStore.getState().nodes.find((item) => item.id === id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
}

beforeEach(() => reset());

describe("nodes", () => {
  it("adds a typed node, selects it, and records history", () => {
    const id = add("text", 40, 60);
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(node(id).type).toBe("text");
    expect(node(id).selected).toBe(true);
    expect(node(id).data).toMatchObject({ text: "Text", color: "emerald" });
    expect(state.past).toHaveLength(1);
  });

  it("updates node data without touching other nodes", () => {
    const a = add("note", 0, 0);
    const b = add("note", 100, 0);
    useCanvasStore.getState().updateNodeData(a, { title: "Changed" });
    expect(node(a).data).toMatchObject({ title: "Changed" });
    expect(node(b).data).toMatchObject({ title: "Untitled note" });
  });

  it("removes selected nodes and their edges", () => {
    const a = add("note", 0, 0);
    const b = add("note", 100, 0);
    useCanvasStore.setState({
      edges: [{ id: "e1", source: a, target: b }],
    });
    useCanvasStore.getState().selectNodes([a]);
    useCanvasStore.getState().removeSelected();
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual([b]);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });

  it("removes selected edges on their own", () => {
    const a = add("note", 0, 0);
    const b = add("note", 100, 0);
    useCanvasStore.setState({ edges: [{ id: "e1", source: a, target: b, selected: true }] });
    useCanvasStore.getState().selectNodes([]);
    useCanvasStore.getState().removeSelected();
    expect(useCanvasStore.getState().nodes).toHaveLength(2);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });

  it("removes group children together with the group", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected();
    expect(groupId).toBeTruthy();
    useCanvasStore.getState().selectNodes([groupId as string]);
    useCanvasStore.getState().removeSelected();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });
});

describe("templates", () => {
  it("inserts a centered flowchart with edges and selects it", () => {
    const existing = add("note", -1000, -1000);
    useCanvasStore.getState().selectNodes([]);
    const ids = useCanvasStore.getState().insertTemplate("flowchart", { x: 500, y: 500 });
    const state = useCanvasStore.getState();

    expect(ids).toHaveLength(4);
    expect(state.nodes).toHaveLength(5);
    expect(state.edges).toHaveLength(3);
    expect(node(existing).selected).toBe(false);

    const created = ids.map((id) => node(id));
    expect(created.every((item) => item.selected)).toBe(true);
    const minX = Math.min(...created.map((item) => item.position.x));
    const maxX = Math.max(...created.map((item) => item.position.x + (item.width ?? 0)));
    const minY = Math.min(...created.map((item) => item.position.y));
    const maxY = Math.max(...created.map((item) => item.position.y + (item.height ?? 0)));
    expect((minX + maxX) / 2).toBeCloseTo(500);
    expect((minY + maxY) / 2).toBeCloseTo(500);

    const idsSet = new Set(ids);
    expect(state.edges.every((edge) => idsSet.has(edge.source) && idsSet.has(edge.target))).toBe(true);
  });

  it("undoes a template insertion in one step", () => {
    useCanvasStore.getState().insertTemplate("kanban", { x: 0, y: 0 });
    expect(useCanvasStore.getState().nodes).toHaveLength(3);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it("ignores unknown templates without touching history", () => {
    expect(useCanvasStore.getState().insertTemplate("nope", { x: 0, y: 0 })).toEqual([]);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(useCanvasStore.getState().past).toHaveLength(0);
  });
});

describe("connections", () => {
  it("rejects self-connections and duplicate edges", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    const store = useCanvasStore.getState();
    expect(store.isValidConnection({ source: a, target: a, sourceHandle: null, targetHandle: null })).toBe(
      false,
    );
    expect(store.isValidConnection({ source: a, target: b, sourceHandle: null, targetHandle: null })).toBe(
      true,
    );
    store.onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    useCanvasStore
      .getState()
      .onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    expect(useCanvasStore.getState().edges).toHaveLength(1);
  });

  it("updates label, style and marker on one edge only", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.setState({
      edges: [
        { id: "e1", source: a, target: b },
        { id: "e2", source: b, target: a },
      ],
    });
    useCanvasStore.getState().updateEdge("e1", {
      label: "flow",
      style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 4" },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: "#f59e0b",
      },
    });
    const [e1, e2] = useCanvasStore.getState().edges;
    expect(e1).toMatchObject({
      label: "flow",
      style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 4" },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#f59e0b" },
    });
    expect(e2.label).toBeUndefined();
    expect(e2.style).toBeUndefined();
  });

  it("removes an edge and can undo it", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.setState({ edges: [{ id: "e1", source: a, target: b }] });
    useCanvasStore.getState().removeEdge("e1");
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().edges).toHaveLength(1);
  });

  it("creates a downstream node connected from the source", () => {
    const a = add("note", 0, 0);
    useCanvasStore.getState().selectNodes([]);
    const id = useCanvasStore.getState().addConnectedNode(
      "note",
      { x: 500, y: 300 },
      { fromNodeId: a, fromHandleType: "source" },
    );
    expect(node(id).position).toEqual({ x: 500, y: 205 });
    expect(useCanvasStore.getState().edges[0]).toMatchObject({ source: a, target: id });
  });

  it("creates an upstream node connected into the target", () => {
    const a = add("note", 0, 0);
    useCanvasStore.getState().selectNodes([]);
    const id = useCanvasStore.getState().addConnectedNode(
      "text",
      { x: 500, y: 300 },
      { fromNodeId: a, fromHandleType: "target" },
    );
    expect(node(id).position).toEqual({ x: 260, y: 245 });
    expect(useCanvasStore.getState().edges[0]).toMatchObject({ source: id, target: a });
  });
});

describe("history", () => {
  it("undoes and redoes an added node", () => {
    add("note", 0, 0);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });

  it("clears the redo stack after a new change", () => {
    add("note", 0, 0);
    useCanvasStore.getState().undo();
    add("note", 50, 50);
    expect(useCanvasStore.getState().future).toHaveLength(0);
  });
});

describe("clipboard", () => {
  it("duplicates nodes and internal edges with new ids", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.setState({ edges: [{ id: "e1", source: a, target: b }] });
    useCanvasStore.getState().selectNodes([a, b]);
    useCanvasStore.getState().duplicateSelected();
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(4);
    expect(state.edges).toHaveLength(2);
    expect(new Set(state.edges.map((edge) => edge.id)).size).toBe(2);
    expect(state.nodes.filter((item) => item.selected)).toHaveLength(2);
  });

  it("pastes a copy offset from the source", () => {
    const a = add("note", 0, 0);
    useCanvasStore.getState().selectNodes([a]);
    useCanvasStore.getState().copySelected();
    useCanvasStore.getState().paste();
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[1].position).toEqual({ x: 36, y: 36 });
  });
});

describe("arrange", () => {
  it("aligns selected nodes to the left edge", () => {
    const a = add("note", 100, 0);
    const b = add("note", 300, 120);
    useCanvasStore.getState().selectNodes([a, b]);
    useCanvasStore.getState().alignSelected("left");
    expect(node(a).position.x).toBe(100);
    expect(node(b).position.x).toBe(100);
  });

  it("distributes three nodes evenly", () => {
    const a = add("note", 0, 0);
    const b = add("note", 500, 0);
    const c = add("note", 1200, 0);
    useCanvasStore.getState().selectNodes([a, b, c]);
    useCanvasStore.getState().distributeSelected("x");
    expect(node(a).position.x).toBe(0);
    expect(node(b).position.x).toBe(600);
    expect(node(c).position.x).toBe(1200);
  });

  it("changes stacking order", () => {
    const a = add("note", 0, 0);
    const b = add("note", 10, 10);
    useCanvasStore.getState().bringToFront([a]);
    expect(node(a).zIndex).toBeGreaterThan(node(b).zIndex ?? 0);
    useCanvasStore.getState().sendToBack([a]);
    expect(node(a).zIndex).toBeLessThan(node(b).zIndex ?? 0);
  });
});

describe("grouping", () => {
  it("creates a group around the selection and restores positions on ungroup", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;

    const group = node(groupId);
    expect(group.type).toBe("group");
    expect(group.position).toEqual({ x: -32, y: -32 });
    expect(group.width).toBe(624);
    expect(group.height).toBe(254);
    expect(node(a).parentId).toBe(groupId);
    expect(node(a).extent).toBeUndefined();
    expect(node(a).position).toEqual({ x: 32, y: 32 });

    useCanvasStore.getState().selectNodes([groupId]);
    useCanvasStore.getState().ungroupSelected();
    expect(useCanvasStore.getState().nodes.map((item) => item.id).sort()).toEqual([a, b].sort());
    expect(node(a).position).toEqual({ x: 0, y: 0 });
    expect(node(b).position).toEqual({ x: 300, y: 0 });
    expect(node(a).selected).toBe(true);
  });
});

describe("selection, nudging and stacking", () => {
  it("selects all and toggles back off", () => {
    const a = add("note", 0, 0);
    const b = add("note", 100, 0);
    useCanvasStore.getState().selectNodes([]);
    useCanvasStore.getState().selectAll();
    expect(useCanvasStore.getState().nodes.every((item) => item.selected)).toBe(true);
    useCanvasStore.getState().selectAll();
    expect(useCanvasStore.getState().nodes.some((item) => item.selected)).toBe(false);
    expect([a, b].every((id) => node(id))).toBe(true);
  });

  it("clears node and edge selection", () => {
    const a = add("note", 0, 0);
    useCanvasStore.setState({ edges: [{ id: "e1", source: a, target: a, selected: true }] });
    useCanvasStore.getState().clearSelection();
    expect(useCanvasStore.getState().nodes.some((item) => item.selected)).toBe(false);
    expect(useCanvasStore.getState().edges.some((edge) => edge.selected)).toBe(false);
  });

  it("nudges top-level selected nodes without double-moving children", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;
    useCanvasStore.getState().selectNodes([groupId, a]);
    useCanvasStore.getState().nudgeSelected(5, 7);
    expect(node(groupId).position).toEqual({ x: -27, y: -25 });
    expect(node(a).position).toEqual({ x: 32, y: 32 });
  });

  it("raises a node without recording history", () => {
    const a = add("note", 0, 0);
    add("note", 100, 0);
    const historyBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().raiseNode(a);
    expect(node(a).zIndex).toBeGreaterThan(0);
    expect(useCanvasStore.getState().past.length).toBe(historyBefore);
  });

  it("pins group containers below other nodes", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;
    useCanvasStore.getState().raiseNode(groupId);
    expect(node(groupId).zIndex).toBeLessThan(0);
  });
});

describe("viewport", () => {
  it("keeps the viewport in the snapshot", () => {
    useCanvasStore.getState().setViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(useCanvasStore.getState().getSnapshot().viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it("imports a viewport from a snapshot", () => {
    useCanvasStore.getState().importSnapshot({
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 1, y: 2, zoom: 0.75 },
    });
    expect(useCanvasStore.getState().viewport).toEqual({ x: 1, y: 2, zoom: 0.75 });
  });
});

describe("reparenting", () => {
  it("moves a node into a group, expands the group and keeps positions", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;
    const c = add("note", 0, 400);
    useCanvasStore.getState().selectNodes([]);

    useCanvasStore.getState().reparentNode(c, groupId);

    expect(node(c).parentId).toBe(groupId);
    expect(node(c).position).toEqual({ x: 32, y: 432 });
    expect(node(a).position).toEqual({ x: 32, y: 32 });
    expect(node(groupId).height).toBe(654);
    expect(node(groupId).width).toBe(624);
  });

  it("moves a child out while preserving its absolute position", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;

    useCanvasStore.getState().reparentNode(a, null);

    expect(node(a).parentId).toBeUndefined();
    expect(node(a).position).toEqual({ x: 0, y: 0 });
    expect(node(groupId).width).toBe(624);
  });

  it("keeps a parent before its new child in the node array", () => {
    const early = add("note", 0, 500);
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const groupId = useCanvasStore.getState().groupSelected() as string;

    useCanvasStore.getState().reparentNode(early, groupId);

    const ids = useCanvasStore.getState().nodes.map((item) => item.id);
    expect(ids.indexOf(groupId)).toBeLessThan(ids.indexOf(early));
  });

  it("moves a node between groups", () => {
    const a = add("note", 0, 0);
    const b = add("note", 300, 0);
    useCanvasStore.getState().selectNodes([a, b]);
    const firstGroup = useCanvasStore.getState().groupSelected() as string;

    const c = add("note", 900, 0);
    const d = add("note", 1200, 0);
    useCanvasStore.getState().selectNodes([c, d]);
    const secondGroup = useCanvasStore.getState().groupSelected() as string;

    useCanvasStore.getState().reparentNode(c, firstGroup);

    expect(node(c).parentId).toBe(firstGroup);
    expect(node(c).position).toEqual({ x: 932, y: 32 });
    expect(node(d).parentId).toBe(secondGroup);
  });
});

describe("auto layout", () => {
  it("moves connected nodes apart", async () => {
    const a = add("note", 0, 0);
    const b = add("note", 10, 10);
    useCanvasStore.setState({ edges: [{ id: "e1", source: a, target: b }] });
    await useCanvasStore.getState().autoLayout();
    const pa = node(a).position;
    const pb = node(b).position;
    expect(Number.isFinite(pa.x) && Number.isFinite(pa.y)).toBe(true);
    expect(Number.isFinite(pb.x) && Number.isFinite(pb.y)).toBe(true);
    expect(pb.x).toBeGreaterThan(pa.x);
  });
});
