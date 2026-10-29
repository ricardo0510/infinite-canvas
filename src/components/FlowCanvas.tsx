import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  useStoreApi,
  ViewportPortal,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
} from "@xyflow/react";
import { lazy, Suspense, useCallback, useEffect, useState, type MouseEvent } from "react";
import { GRID_SIZE } from "../lib/geometry";
import { setPasteAnchor } from "../lib/pasteAnchor";
import { buildStressSnapshot } from "../lib/stress";
import { snapDragChanges } from "../lib/guides";
import { DEFAULT_EDGE_STROKE, NOTE_COLORS } from "../lib/theme";
import { useCanvasKeys } from "../hooks/useCanvasKeys";
import { useImageDrop } from "../hooks/useImageDrop";
import { useNodeGrouping } from "../hooks/useNodeGrouping";
import { useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";
import { useUiStore } from "../store/uiStore";
import type { CanvasNode, NoteColor } from "../types";
import { CanvasControls } from "./CanvasControls";
import { CommandPalette } from "./CommandPalette";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { EdgeToolbar } from "./EdgeToolbar";
import { EmptyState } from "./EmptyState";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { CanvasEdge } from "./edges/CanvasEdge";
import { SelectionToolbar } from "./SelectionToolbar";
import { GroupNode } from "./nodes/GroupNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { NodeSelectionToolbar } from "./nodes/NodeSelectionToolbar";
import { VideoNode } from "./nodes/VideoNode";

const AiPanel = lazy(async () => {
  const module = await import("./ai/AiPanel");
  return { default: module.AiPanel };
});

const nodeTypes = {
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  group: GroupNode,
} satisfies NodeTypes;

const edgeTypes = { smoothstep: CanvasEdge, bezier: CanvasEdge } satisfies EdgeTypes;

const edgeOptions = {
  type: "bezier",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { stroke: DEFAULT_EDGE_STROKE, strokeWidth: 1.5 },
};

/** Above this node count the minimap is collapsed automatically (it can be reopened). */
const MINIMAP_AUTO_HIDE = 60;
/** Above this node count only nodes inside the viewport are mounted. */
const VIRTUALIZE_THRESHOLD = 80;

function eventPoint(
  event: globalThis.MouseEvent | globalThis.TouchEvent,
): { x: number; y: number } | null {
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = event.changedTouches[0] ?? event.touches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

export function FlowCanvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const storeOnNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const isValidConnection = useCanvasStore((state) => state.isValidConnection);
  const addNode = useCanvasStore((state) => state.addNode);
  const raiseNode = useCanvasStore((state) => state.raiseNode);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const [initialViewport] = useState(() => useCanvasStore.getState().viewport);
  const [benchCount] = useState(() => {
    const count = Number(new URLSearchParams(window.location.search).get("bench"));
    return Number.isFinite(count) && count > 0 ? Math.min(3000, Math.floor(count)) : 0;
  });
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const showMiniMap = useUiStore((state) => state.showMiniMap);
  const setMiniMap = useUiStore((state) => state.setMiniMap);
  const aiPanelNodeId = useUiStore((state) => state.aiPanelNodeId);
  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const setAiPanelNode = useUiStore((state) => state.setAiPanelNode);
  const flowStore = useStoreApi();
  const { screenToFlowPosition, setViewport: setFlowViewport } = useReactFlow();
  useCanvasKeys();
  const { dragOver, handleDragOver, handleDragLeave, handleDrop } = useImageDrop();
  const { guides, clearGuides, handleNodeDragStart, handleNodeDrag, handleNodeDragStop } =
    useNodeGrouping();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (nodes.length >= MINIMAP_AUTO_HIDE) setMiniMap(false);
  }, [nodes.length, setMiniMap]);

  useEffect(() => {
    if (!benchCount) return;
    useCanvasStore.getState().importSnapshot(buildStressSnapshot(benchCount));
    window.setTimeout(() => {
      setFlowViewport({ x: 40, y: 40, zoom: 1 });
      document.documentElement.dataset.bench = String(benchCount);
      document.documentElement.dataset.benchReady = String(Math.round(performance.now()));
      useToastStore.getState().push(`基准模式：${benchCount} 个节点`, "info");
    }, 0);
  }, [benchCount, setFlowViewport]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const zoom = flowStore.getState().transform[2] || 1;
      storeOnNodesChange(snapDragChanges(changes, useCanvasStore.getState().nodes, zoom));
    },
    [flowStore, storeOnNodesChange],
  );

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".react-flow__node, .react-flow__edge, .react-flow__panel, .react-flow__controls, .react-flow__minimap, .statusbar, .canvas-controls, .context-menu, .selection-toolbar, .empty-state",
      )
    ) {
      return;
    }
    addNode("text", screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: CanvasNode) => {
      raiseNode(node.id);
      if (node.type !== "text" && node.type !== "image" && node.type !== "video") {
        setAiPanelNode(null);
        return;
      }
      if ((node.data as { static?: boolean }).static === true) {
        setAiPanelNode(null);
        return;
      }
      setAiPanelNode(node.id);
    },
    [raiseNode, setAiPanelNode],
  );

  const openMenu = (event: MouseEvent, targetIds: string[]) => {
    event.preventDefault();
    const targetNodes = targetIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node));
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setPasteAnchor(point);
    setMenu({
      x: event.clientX,
      y: event.clientY,
      flow: point,
      targetIds,
      hasGroup: targetNodes.some((node) => node.type === "group"),
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setPasteAnchor(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const handlePaneContextMenu = (event: MouseEvent | globalThis.MouseEvent) => {
    openMenu(event as MouseEvent, []);
  };

  const handleNodeContextMenu = (event: MouseEvent, node: CanvasNode) => {
    const selected = nodes.filter((item) => item.selected).map((item) => item.id);
    openMenu(event, node.selected && selected.length > 0 ? selected : [node.id]);
  };

  // Dropping a connection on empty canvas opens the add-node menu and connects
  // the new node in the direction the user dragged.
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (!state.fromNode || state.toNode) return;
      const point = eventPoint(event);
      if (!point) return;
      const element = document.elementFromPoint(point.x, point.y);
      if (!element || !element.closest(".canvas")) return;
      if (
        element.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__panel, .toolbar, .canvas-controls, .statusbar, .selection-toolbar, .help-modal, .context-menu, .modal-backdrop, .empty-state",
        )
      ) {
        return;
      }
      const fromHandleType = state.fromHandle?.type === "target" ? "target" : "source";
      setMenu({
        x: point.x,
        y: point.y,
        flow: screenToFlowPosition(point),
        targetIds: [],
        hasGroup: false,
        connection: { fromNodeId: state.fromNode.id, fromHandleType },
      });
    },
    [screenToFlowPosition],
  );

  return (
    <div
      className="canvas"
      onDoubleClick={handleDoubleClick}
      onPointerMove={handlePointerMove}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => {
          clearGuides();
          setAiPanelNode(null);
        }}
        onMoveEnd={(_event, viewport) => setViewport(viewport)}
        deleteKeyCode={null}
        colorMode="dark"
        defaultMarkerColor="#7c8598"
        defaultViewport={initialViewport ?? undefined}
        fitView={!initialViewport && benchCount === 0}
        fitViewOptions={{ padding: 0.25, maxZoom: 1.25 }}
        onlyRenderVisibleElements={nodes.length >= VIRTUALIZE_THRESHOLD}
        minZoom={0.15}
        maxZoom={4}
        snapToGrid={snapToGrid}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        multiSelectionKeyCode={["Shift", "Control", "Meta"]}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={edgeOptions}
        connectionLineStyle={{ stroke: NOTE_COLORS.violet, strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a3040" />
        {showMiniMap ? (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            maskColor="rgba(8, 10, 15, 0.72)"
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              if (node.type === "group") return "#2c2518";
              if (node.type === "video") return "#f59e0b";
              const color = (node.data as { color?: NoteColor } | undefined)?.color;
              return color ? NOTE_COLORS[color] : DEFAULT_EDGE_STROKE;
            }}
          />
        ) : null}
        <ViewportPortal>
          {guides.map((guide) => (
            <div
              key={`${guide.orientation}-${guide.position}`}
              className={`align-guide align-guide-${guide.orientation}`}
              style={
                guide.orientation === "vertical"
                  ? { left: guide.position, top: guide.start, height: guide.end - guide.start }
                  : { top: guide.position, left: guide.start, width: guide.end - guide.start }
              }
            />
          ))}
        </ViewportPortal>
      </ReactFlow>
      {dragOver ? (
        <div className="drop-overlay">
          <div className="drop-card">
            <span className="drop-plus" aria-hidden="true">
              +
            </span>
            <strong>拖入图片以添加节点</strong>
            <span>PNG、JPG、GIF 或 WebP · 每张不超过 4 MB</span>
          </div>
        </div>
      ) : null}
      {selectedNode ? <NodeSelectionToolbar node={selectedNode} /> : null}
      {aiPanelNodeId ? (
        <Suspense fallback={null}>
          <AiPanel />
        </Suspense>
      ) : null}
      <MediaPreviewModal />
      <CanvasControls />
      <EmptyState />
      <SelectionToolbar />
      <EdgeToolbar />
      <CommandPalette />
      {menu ? (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
