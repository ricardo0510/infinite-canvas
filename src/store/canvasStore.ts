import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { loadSnapshot } from "../lib/storage";
import type { CanvasEdge, CanvasNode, CanvasSnapshot, NoteColor, NoteData } from "../types";

const HISTORY_LIMIT = 50;
const PASTE_OFFSET = 36;

const demo: CanvasSnapshot = {
  nodes: [
    {
      id: "welcome",
      type: "note",
      position: { x: 80, y: 120 },
      data: {
        title: "Infinite Canvas",
        body: "双击空白处添加节点。\n拖拽右侧端口连线。\nCtrl/Cmd + Z 撤销，Ctrl/Cmd + S 保存。",
        color: "violet",
      },
    },
    {
      id: "idea",
      type: "note",
      position: { x: 460, y: 260 },
      data: {
        title: "A small idea",
        body: "每个节点都是一张卡片，标题和正文可以直接编辑。\n右下角可以拉高正文区域。",
        color: "cyan",
      },
    },
  ],
  edges: [
    {
      id: "edge-welcome-idea",
      source: "welcome",
      target: "idea",
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { stroke: "#5b6478", strokeWidth: 1.5 },
    },
  ],
};

function newId(prefix: "note" | "edge"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  offset: { x: number; y: number },
): CanvasSnapshot {
  const idMap = new Map<string, string>();
  const nextNodes = nodes.map((node) => {
    const id = newId("note");
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      selected: true,
      data: { ...node.data },
    };
  });
  const nextEdges = edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: newId("edge"),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: false,
    }));
  return { nodes: nextNodes, edges: nextEdges };
}

function defaultEdge(connection: Connection): CanvasEdge {
  return {
    ...connection,
    id: newId("edge"),
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: "#5b6478", strokeWidth: 1.5 },
  };
}

type CanvasState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  clipboard: CanvasSnapshot | null;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  commit: () => void;
  addNote: (position: { x: number; y: number }) => string;
  updateNote: (id: string, patch: Partial<Pick<NoteData, "title" | "body" | "color">>) => void;
  removeSelected: () => void;
  copySelected: () => void;
  duplicateSelected: () => void;
  paste: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  importSnapshot: (snapshot: CanvasSnapshot) => void;
  getSnapshot: () => CanvasSnapshot;
};

const initial = loadSnapshot() ?? demo;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  past: [],
  future: [],
  clipboard: null,

  onNodesChange: (changes) => {
    if (changes.some((change) => change.type === "remove")) get().commit();
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    if (changes.some((change) => change.type === "remove")) get().commit();
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    get().commit();
    set({ edges: addEdge(defaultEdge(connection), get().edges) });
  },

  commit: () => {
    const { nodes, edges, past } = get();
    const last = past[past.length - 1];
    if (last && last.nodes === nodes && last.edges === edges) return;
    set({
      past: [...past.slice(-(HISTORY_LIMIT - 1)), { nodes, edges }],
      future: [],
    });
  },

  addNote: (position) => {
    get().commit();
    const id = newId("note");
    const node: CanvasNode = {
      id,
      type: "note",
      position,
      selected: true,
      data: { title: "Untitled note", body: "", color: "violet" },
    };
    set({ nodes: [...get().nodes.map((item) => ({ ...item, selected: false })), node] });
    return id;
  },

  updateNote: (id, patch) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    });
  },

  removeSelected: () => {
    const { nodes, edges } = get();
    const selected = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    if (selected.size === 0) return;
    get().commit();
    set({
      nodes: nodes.filter((node) => !selected.has(node.id)),
      edges: edges.filter((edge) => !selected.has(edge.source) && !selected.has(edge.target)),
    });
  },

  copySelected: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) return;
    const ids = new Set(selected.map((node) => node.id));
    set({
      clipboard: {
        nodes: selected,
        edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      },
    });
  },

  duplicateSelected: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) return;
    const ids = new Set(selected.map((node) => node.id));
    const copiedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
    get().commit();
    const clone = cloneSelection(selected, copiedEdges, { x: PASTE_OFFSET, y: PASTE_OFFSET });
    set({
      nodes: [...nodes.map((node) => ({ ...node, selected: false })), ...clone.nodes],
      edges: [...edges, ...clone.edges],
    });
  },

  paste: () => {
    const { clipboard } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    get().commit();
    const clone = cloneSelection(clipboard.nodes, clipboard.edges, { x: PASTE_OFFSET, y: PASTE_OFFSET });
    set({
      nodes: [...get().nodes.map((node) => ({ ...node, selected: false })), ...clone.nodes],
      edges: [...get().edges, ...clone.edges],
    });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future].slice(0, HISTORY_LIMIT),
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
    });
  },

  clear: () => {
    get().commit();
    set({ nodes: [], edges: [] });
  },

  importSnapshot: (snapshot) => {
    get().commit();
    set({
      nodes: snapshot.nodes.map((node) => ({ ...node, selected: false })),
      edges: snapshot.edges.map((edge) => ({ ...edge, selected: false })),
    });
  },

  getSnapshot: () => ({ nodes: get().nodes, edges: get().edges }),
}));

export const NOTE_COLORS: Record<NoteColor, string> = {
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  emerald: "#34d399",
};
