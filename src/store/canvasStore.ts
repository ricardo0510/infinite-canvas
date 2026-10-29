import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import {
  absolutePosition,
  AI_NODE_WIDTH,
  byId,
  DEFAULT_SIZE,
  descendantIds,
  hasAncestor,
  mediaNodeHeight,
  nodeRect,
  nodeSize,
} from "../lib/geometry";
import { loadSnapshot, sanitizeImageSrc, SCHEMA_VERSION } from "../lib/storage";
import { TEMPLATE_MAP } from "../lib/templates";
import type {
  AlignKind,
  CanvasEdge,
  CanvasNode,
  CanvasSnapshot,
  DistributeAxis,
  GroupData,
  NodeKind,
  NoteColor,
} from "../types";

const HISTORY_LIMIT = 50;
const PASTE_OFFSET = 36;
const GROUP_PADDING = 32;

const demo: CanvasSnapshot = {
  version: SCHEMA_VERSION,
  nodes: [
    {
      id: "welcome",
      type: "text",
      position: { x: 80, y: 120 },
      width: DEFAULT_SIZE.text.width,
      height: DEFAULT_SIZE.text.height,
      style: { width: DEFAULT_SIZE.text.width, height: DEFAULT_SIZE.text.height },
      data: {
        title: "无限画布",
        text: "双击空白处添加文本节点。\n右键打开菜单，拖拽右侧端口连线。\n单击节点打开生成输入框。",
        color: "violet",
        fontSize: 14,
      },
    },
    {
      id: "idea",
      type: "text",
      position: { x: 460, y: 260 },
      width: DEFAULT_SIZE.text.width,
      height: DEFAULT_SIZE.text.height,
      style: { width: DEFAULT_SIZE.text.width, height: DEFAULT_SIZE.text.height },
      data: {
        title: "一个小想法",
        text: "节点顶部可以拖拽，双击标题可以重命名。\n图片和视频节点会根据内容比例调整高度。",
        color: "cyan",
        fontSize: 14,
      },
    },
  ],
  edges: [
    {
      id: "edge-welcome-idea",
      source: "welcome",
      target: "idea",
      type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { stroke: "#5b6478", strokeWidth: 1.5 },
    },
  ],
};

function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${uuid}`;
}

function createNode(kind: NodeKind, position: XYPosition): CanvasNode {
  const base = {
    id: newId(kind),
    position,
    selected: true,
    ...DEFAULT_SIZE[kind],
    style: { ...DEFAULT_SIZE[kind] },
  };
  switch (kind) {
    case "text": {
      const node: CanvasNode = {
        ...base,
        type: "text",
        data: { title: "文本", text: "", color: "emerald", fontSize: 16 },
      };
      return node;
    }
    case "image": {
      const node: CanvasNode = {
        ...base,
        type: "image",
        data: { title: "图片", src: "", alt: "" },
      };
      return node;
    }
    case "video": {
      const node: CanvasNode = {
        ...base,
        type: "video",
        data: { title: "视频", src: "", thumbnailUrl: "", alt: "" },
      };
      return node;
    }
    default: {
      const node: CanvasNode = {
        ...base,
        type: "group",
        data: { label: "分组", color: "amber" },
        zIndex: -1,
      };
      return node;
    }
  }
}

function cloneSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  offset: XYPosition,
): CanvasSnapshot {
  const idMap = new Map<string, string>();
  for (const node of nodes) idMap.set(node.id, newId(node.type ?? "node"));

  const nextNodes = nodes.map((node) => {
    const id = idMap.get(node.id) as string;
    const copy = {
      ...node,
      id,
      selected: true,
      data: { ...node.data },
      style: node.style ? { ...node.style } : undefined,
      position: { ...node.position },
    } as CanvasNode;
    if (node.parentId && idMap.has(node.parentId)) {
      copy.parentId = idMap.get(node.parentId);
    } else {
      delete copy.parentId;
      delete copy.extent;
      copy.position = {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      };
    }
    return copy;
  });

  const nextEdges = edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: newId("edge"),
      source: idMap.get(edge.source) as string,
      target: idMap.get(edge.target) as string,
      selected: false,
    }));

  return { version: SCHEMA_VERSION, nodes: nextNodes, edges: nextEdges };
}

function defaultEdge(connection: Connection): CanvasEdge {
  return {
    ...connection,
    id: newId("edge"),
    type: "bezier",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: "#5b6478", strokeWidth: 1.5 },
  };
}

/** Selected nodes, minus any whose ancestor group is also selected. */
function topLevelSelection(nodes: CanvasNode[]): CanvasNode[] {
  const index = byId(nodes);
  return nodes.filter((node) => {
    if (!node.selected) return false;
    let parentId = node.parentId;
    const seen = new Set<string>([node.id]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = index.get(parentId);
      if (!parent) break;
      if (parent.selected) return false;
      parentId = parent.parentId;
    }
    return true;
  });
}

/**
 * Expands a group just enough to contain the given absolute child rect with
 * padding. Existing children keep their absolute positions.
 */
function expandGroupToFit(
  nodes: CanvasNode[],
  groupId: string,
  childAbsolute: XYPosition,
  childSize: { width: number; height: number },
): CanvasNode[] {
  const index = byId(nodes);
  const group = index.get(groupId);
  if (!group) return nodes;

  const groupRect = nodeRect(group, index);
  const minX = Math.min(groupRect.x, childAbsolute.x - GROUP_PADDING);
  const minY = Math.min(groupRect.y, childAbsolute.y - GROUP_PADDING);
  const maxX = Math.max(
    groupRect.x + groupRect.width,
    childAbsolute.x + childSize.width + GROUP_PADDING,
  );
  const maxY = Math.max(
    groupRect.y + groupRect.height,
    childAbsolute.y + childSize.height + GROUP_PADDING,
  );
  const unchanged =
    minX === groupRect.x &&
    minY === groupRect.y &&
    maxX === groupRect.x + groupRect.width &&
    maxY === groupRect.y + groupRect.height;
  if (unchanged) return nodes;

  const width = maxX - minX;
  const height = maxY - minY;
  const parent = group.parentId ? index.get(group.parentId) : undefined;
  const parentPosition = parent ? absolutePosition(parent, index) : { x: 0, y: 0 };
  const groupPosition = { x: minX - parentPosition.x, y: minY - parentPosition.y };

  return nodes.map((node) => {
    if (node.id === groupId) {
      return {
        ...node,
        position: groupPosition,
        width,
        height,
        style: { ...node.style, width, height },
      };
    }
    if (node.parentId === groupId) {
      const absolute = absolutePosition(node, index);
      return {
        ...node,
        position: { x: absolute.x - minX, y: absolute.y - minY },
      };
    }
    return node;
  });
}

function moveTo(node: CanvasNode, absolute: XYPosition, index: Map<string, CanvasNode>): CanvasNode {
  if (!node.parentId) return { ...node, position: absolute };
  const parent = index.get(node.parentId);
  if (!parent) return { ...node, position: absolute };
  const parentPosition = absolutePosition(parent, index);
  return {
    ...node,
    position: { x: absolute.x - parentPosition.x, y: absolute.y - parentPosition.y },
  };
}

type CanvasState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  clipboard: CanvasSnapshot | null;
  viewport: Viewport | null;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | CanvasEdge) => boolean;
  updateEdge: (
    id: string,
    patch: { label?: string; style?: CanvasEdge["style"]; markerEnd?: CanvasEdge["markerEnd"] },
  ) => void;
  removeEdge: (id: string) => void;
  addConnectedNode: (
    kind: NodeKind,
    position: XYPosition,
    connection: { fromNodeId: string; fromHandleType: "source" | "target" },
  ) => string;
  commit: () => void;
  addNode: (kind: NodeKind, position: XYPosition) => string;
  addImages: (
    images: {
      position: XYPosition;
      src: string;
      width: number;
      height: number;
      alt?: string;
    }[],
  ) => string[];
  resizeNode: (id: string, width: number, height: number) => void;
  replaceImageSources: (updates: Map<string, string>) => void;
  insertTemplate: (templateId: string, anchor: XYPosition) => string[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setViewport: (viewport: Viewport) => void;
  selectNodes: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  raiseNode: (id: string) => void;
  removeSelected: () => void;
  copySelected: () => void;
  duplicateSelected: () => void;
  paste: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  importSnapshot: (snapshot: CanvasSnapshot) => void;
  getSnapshot: () => CanvasSnapshot;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  alignSelected: (kind: AlignKind) => void;
  distributeSelected: (axis: DistributeAxis) => void;
  groupSelected: () => string | null;
  ungroupSelected: () => void;
  /** Moves a node into a group (or out when groupId is null). Does not push history. */
  reparentNode: (nodeId: string, groupId: string | null) => void;
  autoLayout: () => Promise<void>;
};

const initial = loadSnapshot() ?? demo;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  past: [],
  future: [],
  clipboard: null,
  viewport: initial.viewport ?? null,

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
    if (!get().isValidConnection(connection)) return;
    get().commit();
    set({ edges: addEdge(defaultEdge(connection), get().edges) });
  },

  isValidConnection: (connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return false;
    const { nodes, edges } = get();
    if (!nodes.some((node) => node.id === source) || !nodes.some((node) => node.id === target)) {
      return false;
    }
    const handle = (value: string | null | undefined) => value ?? null;
    return !edges.some(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        handle(edge.sourceHandle) === handle(connection.sourceHandle) &&
        handle(edge.targetHandle) === handle(connection.targetHandle),
    );
  },

  updateEdge: (id, patch) => {
    const { edges } = get();
    if (!edges.some((edge) => edge.id === id)) return;
    set({
      edges: edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)),
    });
  },

  removeEdge: (id) => {
    const { edges } = get();
    if (!edges.some((edge) => edge.id === id)) return;
    get().commit();
    set({ edges: edges.filter((edge) => edge.id !== id) });
  },

  addConnectedNode: (kind, position, connection) => {
    const size = DEFAULT_SIZE[kind];
    const createPosition =
      connection.fromHandleType === "source"
        ? { x: position.x, y: position.y - size.height / 2 }
        : { x: position.x - size.width, y: position.y - size.height / 2 };
    get().commit();
    const node = createNode(kind, createPosition);
    const edge = defaultEdge({
      source: connection.fromHandleType === "source" ? connection.fromNodeId : node.id,
      target: connection.fromHandleType === "source" ? node.id : connection.fromNodeId,
      sourceHandle: null,
      targetHandle: null,
    });
    set({
      nodes: [...get().nodes.map((item) => ({ ...item, selected: false })), node],
      edges: addEdge(edge, get().edges),
    });
    return node.id;
  },

  commit: () => {
    const { nodes, edges, past } = get();
    const last = past[past.length - 1];
    if (last && last.nodes === nodes && last.edges === edges) return;
    set({
      past: [...past.slice(-(HISTORY_LIMIT - 1)), { version: SCHEMA_VERSION, nodes, edges }],
      future: [],
    });
  },

  addNode: (kind, position) => {
    get().commit();
    const node = createNode(kind, position);
    set({ nodes: [...get().nodes.map((item) => ({ ...item, selected: false })), node] });
    return node.id;
  },

  addImages: (images) => {
    if (images.length === 0) return [];
    get().commit();
    const created = images.map((image) => {
      const base = createNode("image", image.position);
      const height = mediaNodeHeight(AI_NODE_WIDTH, image.width, image.height);
      return {
        ...base,
        width: AI_NODE_WIDTH,
        height,
        style: { ...(base.style ?? {}), width: AI_NODE_WIDTH, height },
        data: {
          title: image.alt || "图片",
          static: true,
          src: sanitizeImageSrc(image.src),
          alt: image.alt ?? "",
        },
      } as CanvasNode;
    });
    set({
      nodes: [...get().nodes.map((node) => ({ ...node, selected: false })), ...created],
    });
    return created.map((node) => node.id);
  },

  resizeNode: (id, width, height) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, width, height, style: { ...node.style, width, height } }
          : node,
      ),
    });
  },

  replaceImageSources: (updates) => {
    if (updates.size === 0) return;
    set({
      nodes: get().nodes.map((node) => {
        const src = updates.get(node.id);
        return src ? ({ ...node, data: { ...node.data, src } } as CanvasNode) : node;
      }),
    });
  },

  insertTemplate: (templateId, anchor) => {
    const template = TEMPLATE_MAP[templateId];
    if (!template || template.nodes.length === 0) return [];

    const sizes = template.nodes.map((spec) => ({
      width: spec.width ?? DEFAULT_SIZE[spec.kind].width,
      height: spec.height ?? DEFAULT_SIZE[spec.kind].height,
    }));
    const minX = Math.min(...template.nodes.map((spec) => spec.x));
    const minY = Math.min(...template.nodes.map((spec) => spec.y));
    const maxX = Math.max(
      ...template.nodes.map((spec, index) => spec.x + sizes[index].width),
    );
    const maxY = Math.max(
      ...template.nodes.map((spec, index) => spec.y + sizes[index].height),
    );
    // The anchor is the center of the template.
    const offsetX = anchor.x - (minX + maxX) / 2;
    const offsetY = anchor.y - (minY + maxY) / 2;

    get().commit();
    const created = template.nodes.map((spec, index) => {
      const base = createNode(spec.kind, { x: offsetX + spec.x, y: offsetY + spec.y });
      const { width, height } = sizes[index];
      return {
        ...base,
        width,
        height,
        style: { ...(base.style ?? {}), width, height },
        data: { ...base.data, ...spec.data },
      } as CanvasNode;
    });
    const createdEdges = template.edges.flatMap((edge) => {
      const source = created[edge.from];
      const target = created[edge.to];
      if (!source || !target) return [];
      return [
        defaultEdge({
          source: source.id,
          target: target.id,
          sourceHandle: null,
          targetHandle: null,
        }),
      ];
    });

    set({
      nodes: [...get().nodes.map((node) => ({ ...node, selected: false })), ...created],
      edges: [...get().edges, ...createdEdges],
    });
    return created.map((node) => node.id);
  },

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? ({ ...node, data: { ...node.data, ...patch } } as CanvasNode) : node,
      ),
    });
  },

  setViewport: (viewport) => {
    const current = get().viewport;
    if (current && current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom) {
      return;
    }
    set({ viewport });
  },

  selectNodes: (ids) => {
    const selected = new Set(ids);
    set({ nodes: get().nodes.map((node) => ({ ...node, selected: selected.has(node.id) })) });
  },

  selectAll: () => {
    const { nodes } = get();
    if (nodes.length === 0) return;
    const allSelected = nodes.every((node) => node.selected);
    set({
      nodes: nodes.map((node) => ({ ...node, selected: !allSelected })),
      edges: get().edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
    });
  },

  clearSelection: () => {
    const { nodes, edges } = get();
    const hasSelection = nodes.some((node) => node.selected) || edges.some((edge) => edge.selected);
    if (!hasSelection) return;
    set({
      nodes: nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      edges: edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
    });
  },

  nudgeSelected: (dx, dy) => {
    const { nodes } = get();
    const selected = topLevelSelection(nodes);
    if (selected.length === 0) return;
    get().commit();
    const selectedIds = new Set(selected.map((node) => node.id));
    set({
      nodes: nodes.map((node) =>
        selectedIds.has(node.id)
          ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
          : node,
      ),
    });
  },

  raiseNode: (id) => {
    const { nodes } = get();
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    if (node.type === "group") {
      const minZ = Math.min(0, ...nodes.map((item) => item.zIndex ?? 0));
      if ((node.zIndex ?? 0) <= minZ) return;
      set({
        nodes: nodes.map((item) => (item.id === id ? { ...item, zIndex: minZ - 1 } : item)),
      });
      return;
    }
    const maxZ = Math.max(0, ...nodes.map((item) => item.zIndex ?? 0));
    const topCount = nodes.filter((item) => (item.zIndex ?? 0) === maxZ).length;
    if ((node.zIndex ?? 0) === maxZ && topCount === 1) return;
    set({
      nodes: nodes.map((item) => (item.id === id ? { ...item, zIndex: maxZ + 1 } : item)),
    });
  },

  removeSelected: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdges = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));
    if (selected.length === 0 && selectedEdges.size === 0) return;
    get().commit();
    const removed = descendantIds(selected, nodes);
    set({
      nodes: nodes.filter((node) => !removed.has(node.id)),
      edges: edges.filter(
        (edge) =>
          !selectedEdges.has(edge.id) && !removed.has(edge.source) && !removed.has(edge.target),
      ),
    });
  },

  copySelected: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) return;
    const ids = descendantIds(
      selected.map((node) => node.id),
      nodes,
    );
    set({
      clipboard: {
        version: SCHEMA_VERSION,
        nodes: nodes.filter((node) => ids.has(node.id)),
        edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      },
    });
  },

  duplicateSelected: () => {
    const { nodes, edges } = get();
    const ids = descendantIds(
      nodes.filter((node) => node.selected).map((node) => node.id),
      nodes,
    );
    if (ids.size === 0) return;
    get().commit();
    const clone = cloneSelection(
      nodes.filter((node) => ids.has(node.id)),
      edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      { x: PASTE_OFFSET, y: PASTE_OFFSET },
    );
    set({
      nodes: [...nodes.map((node) => ({ ...node, selected: false })), ...clone.nodes],
      edges: [...edges, ...clone.edges],
    });
  },

  paste: () => {
    const { clipboard } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    get().commit();
    const clone = cloneSelection(clipboard.nodes, clipboard.edges, {
      x: PASTE_OFFSET,
      y: PASTE_OFFSET,
    });
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
      future: [{ version: SCHEMA_VERSION, nodes, edges }, ...future].slice(0, HISTORY_LIMIT),
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { version: SCHEMA_VERSION, nodes, edges }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
    });
  },

  clear: () => {
    if (get().nodes.length === 0 && get().edges.length === 0) return;
    get().commit();
    set({ nodes: [], edges: [] });
  },

  importSnapshot: (snapshot) => {
    get().commit();
    set({
      nodes: snapshot.nodes.map((node) => ({ ...node, selected: false })),
      edges: snapshot.edges.map((edge) => ({ ...edge, selected: false })),
      ...(snapshot.viewport ? { viewport: snapshot.viewport } : {}),
    });
  },

  getSnapshot: () => {
    const { nodes, edges, viewport } = get();
    return {
      version: SCHEMA_VERSION,
      nodes,
      edges,
      ...(viewport ? { viewport } : {}),
    };
  },

  bringToFront: (ids) => {
    if (ids.length === 0) return;
    get().commit();
    const set_ = descendantIds(ids, get().nodes);
    const maxZ = Math.max(0, ...get().nodes.map((node) => node.zIndex ?? 0));
    let offset = 1;
    set({
      nodes: get().nodes.map((node) =>
        set_.has(node.id) ? { ...node, zIndex: maxZ + offset++ } : node,
      ),
    });
  },

  sendToBack: (ids) => {
    if (ids.length === 0) return;
    get().commit();
    const set_ = descendantIds(ids, get().nodes);
    const minZ = Math.min(0, ...get().nodes.map((node) => node.zIndex ?? 0));
    let offset = set_.size;
    set({
      nodes: get().nodes.map((node) =>
        set_.has(node.id) ? { ...node, zIndex: minZ - offset-- } : node,
      ),
    });
  },

  alignSelected: (kind) => {
    const { nodes } = get();
    const selected = topLevelSelection(nodes);
    if (selected.length < 2) return;
    const index = byId(nodes);
    const rects = selected.map((node) => nodeRect(node, index));
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    get().commit();
    const selectedIds = new Set(selected.map((node) => node.id));
    set({
      nodes: nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;
        const rect = nodeRect(node, index);
        let x = rect.x;
        let y = rect.y;
        if (kind === "left") x = left;
        if (kind === "centerX") x = centerX - rect.width / 2;
        if (kind === "right") x = right - rect.width;
        if (kind === "top") y = top;
        if (kind === "centerY") y = centerY - rect.height / 2;
        if (kind === "bottom") y = bottom - rect.height;
        return moveTo(node, { x, y }, index);
      }),
    });
  },

  distributeSelected: (axis) => {
    const { nodes } = get();
    const selected = topLevelSelection(nodes);
    if (selected.length < 3) return;
    const index = byId(nodes);
    const rects = selected
      .map((node) => ({ node, rect: nodeRect(node, index) }))
      .sort((a, b) => (axis === "x" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));

    const first = rects[0].rect;
    const last = rects[rects.length - 1].rect;
    const span =
      axis === "x" ? last.x + last.width - first.x : last.y + last.height - first.y;
    const totalSize = rects.reduce(
      (sum, item) => sum + (axis === "x" ? item.rect.width : item.rect.height),
      0,
    );
    const gap = (span - totalSize) / (rects.length - 1);
    if (!Number.isFinite(gap)) return;

    get().commit();
    const updates = new Map<string, XYPosition>();
    let cursor = axis === "x" ? first.x : first.y;
    for (const item of rects) {
      const size = axis === "x" ? item.rect.width : item.rect.height;
      updates.set(
        item.node.id,
        axis === "x" ? { x: cursor, y: item.rect.y } : { x: item.rect.x, y: cursor },
      );
      cursor += size + gap;
    }
    set({
      nodes: nodes.map((node) => {
        const position_ = updates.get(node.id);
        return position_ ? moveTo(node, position_, index) : node;
      }),
    });
  },

  groupSelected: () => {
    const { nodes } = get();
    const selected = topLevelSelection(nodes);
    if (selected.length < 2) return null;
    const index = byId(nodes);
    const rects = selected.map((node) => nodeRect(node, index));
    const left = Math.min(...rects.map((rect) => rect.x)) - GROUP_PADDING;
    const top = Math.min(...rects.map((rect) => rect.y)) - GROUP_PADDING;
    const right = Math.max(...rects.map((rect) => rect.x + rect.width)) + GROUP_PADDING;
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height)) + GROUP_PADDING;
    const groupId = newId("group");
    const width = right - left;
    const height = bottom - top;
    const minZ = Math.min(0, ...nodes.map((node) => node.zIndex ?? 0)) - 1;

    const group: CanvasNode = {
      id: groupId,
      type: "group",
      position: { x: left, y: top },
      width,
      height,
      style: { width, height },
      data: { label: `${selected.length} 个节点`, color: "amber" } satisfies GroupData,
      zIndex: minZ,
      selected: true,
    };

    const selectedIds = new Set(selected.map((node) => node.id));
    const next = nodes.map((node) => {
      if (!selectedIds.has(node.id)) return node;
      const absolute = absolutePosition(node, index);
      return {
        ...node,
        parentId: groupId,
        selected: false,
        position: { x: absolute.x - left, y: absolute.y - top },
      };
    });

    const firstIndex = next.findIndex((node) => selectedIds.has(node.id));
    const withGroup = [...next];
    withGroup.splice(firstIndex < 0 ? withGroup.length : firstIndex, 0, group);

    get().commit();
    set({ nodes: withGroup });
    return groupId;
  },

  ungroupSelected: () => {
    const { nodes, edges } = get();
    const groups = nodes.filter((node) => node.selected && node.type === "group");
    if (groups.length === 0) return;
    const index = byId(nodes);
    const groupIds = new Set(groups.map((group) => group.id));
    get().commit();

    const next = nodes
      .filter((node) => !groupIds.has(node.id))
      .map((node) => {
        if (!node.parentId || !groupIds.has(node.parentId)) return node;
        const absolute = absolutePosition(node, index);
        const group = index.get(node.parentId);
        const outerId = group?.parentId;
        if (outerId) {
          const outer = index.get(outerId);
          const outerPosition = outer ? absolutePosition(outer, index) : { x: 0, y: 0 };
          return {
            ...node,
            parentId: outerId,
            position: { x: absolute.x - outerPosition.x, y: absolute.y - outerPosition.y },
            selected: true,
          };
        }
        return {
          ...node,
          parentId: undefined,
          extent: undefined,
          position: absolute,
          selected: true,
        } as CanvasNode;
      });

    const remaining = new Set(next.map((node) => node.id));
    set({
      nodes: next,
      edges: edges.filter((edge) => remaining.has(edge.source) && remaining.has(edge.target)),
    });
  },

  reparentNode: (nodeId, groupId) => {
    const { nodes } = get();
    const node = nodes.find((item) => item.id === nodeId);
    if (!node || node.type === "group" || node.id === groupId) return;
    if ((node.parentId ?? null) === groupId) return;

    const index = byId(nodes);
    const target = groupId ? nodes.find((item) => item.id === groupId && item.type === "group") : null;
    if (groupId && !target) return;
    if (target && hasAncestor(target, nodeId, index)) return;

    const absolute = absolutePosition(node, index);
    const size = nodeSize(node);
    let next = nodes.map((item) => {
      if (item.id !== nodeId) return item;
      if (!groupId) {
        return {
          ...item,
          parentId: undefined,
          extent: undefined,
          position: absolute,
        } as CanvasNode;
      }
      const groupPosition = absolutePosition(target as CanvasNode, index);
      return {
        ...item,
        parentId: groupId,
        extent: undefined,
        position: {
          x: absolute.x - groupPosition.x,
          y: absolute.y - groupPosition.y,
        },
      } as CanvasNode;
    });

    if (target) {
      next = expandGroupToFit(next, target.id, absolute, size);
      // React Flow requires a parent to appear before its children in the array.
      const nodeIndex = next.findIndex((item) => item.id === nodeId);
      const [moved] = next.splice(nodeIndex, 1);
      const groupIndex = next.findIndex((item) => item.id === groupId);
      next.splice(groupIndex + 1, 0, moved);
    }
    set({ nodes: next });
  },

  autoLayout: async () => {
    if (get().nodes.length === 0) return;
    // Dagre is only needed for this action, so keep it out of the initial bundle.
    const { layoutNodes } = await import("../lib/layout");
    const { nodes, edges } = get();
    get().commit();
    set({ nodes: layoutNodes(nodes, edges) });
  },
}));

export const NOTE_COLORS: Record<NoteColor, string> = {
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  emerald: "#34d399",
};
