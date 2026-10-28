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
  type OnNodeDrag,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { byId, GRID_SIZE, nodeRect } from "../lib/geometry";
import { storeImage } from "../lib/imageStore";
import { fitImageSize, readImageFile, type LoadedImage } from "../lib/images";
import { buildStressSnapshot } from "../lib/stress";
import { computeGuidesForDragging, snapDragChanges, type Guide } from "../lib/guides";
import { NOTE_COLORS, useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";
import { useUiStore } from "../store/uiStore";
import type { CanvasNode, NoteColor } from "../types";
import { CanvasControls } from "./CanvasControls";
import { CommandPalette } from "./CommandPalette";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { EdgeToolbar } from "./EdgeToolbar";
import { EmptyState } from "./EmptyState";
import { CanvasEdge } from "./edges/CanvasEdge";
import { SelectionToolbar } from "./SelectionToolbar";
import { StatusBar } from "./StatusBar";
import { GroupNode } from "./nodes/GroupNode";
import { ImageNode } from "./nodes/ImageNode";
import { NoteNode } from "./nodes/NoteNode";
import { TextNode } from "./nodes/TextNode";

const nodeTypes = {
  note: NoteNode,
  text: TextNode,
  image: ImageNode,
  group: GroupNode,
} satisfies NodeTypes;

// Override the built-in smoothstep edge so every existing edge gets the
// hover delete affordance without a schema migration.
const edgeTypes = { smoothstep: CanvasEdge } satisfies EdgeTypes;

const edgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { stroke: "#5b6478", strokeWidth: 1.5 },
};

/** Above this node count the minimap is collapsed automatically (it can be reopened). */
const MINIMAP_AUTO_HIDE = 60;
/** Above this node count only nodes inside the viewport are mounted. */
const VIRTUALIZE_THRESHOLD = 80;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

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
  const commit = useCanvasStore((state) => state.commit);
  const addNote = useCanvasStore((state) => state.addNote);
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
  const flowStore = useStoreApi();
  const { screenToFlowPosition, fitView, setViewport: setFlowViewport } = useReactFlow();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const mouseRef = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

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
      useToastStore.getState().push(`Benchmark mode: ${benchCount} nodes`, "info");
    }, 0);
  }, [benchCount, setFlowViewport]);

  const importImages = useCallback(
    async (files: File[], point: { x: number; y: number }) => {
      if (files.length === 0) return;
      const selected = files.slice(0, 12);
      const results = await Promise.allSettled(selected.map(readImageFile));
      const loaded = results
        .filter((result): result is PromiseFulfilledResult<LoadedImage> => result.status === "fulfilled")
        .map((result) => result.value);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const toast = useToastStore.getState().push;

      if (loaded.length === 0) {
        toast(
          rejected?.reason instanceof Error
            ? rejected.reason.message
            : "No images could be read.",
          "error",
        );
        return;
      }

      const origin = screenToFlowPosition(point);
      const refs = await Promise.all(loaded.map((image) => storeImage(image.blob)));
      const specs = loaded.map((image, index) => {
        const size = fitImageSize(image.width, image.height);
        const single = loaded.length === 1;
        return {
          position: {
            x: single ? origin.x - size.width / 2 : origin.x + (index % 3) * 344,
            y: single ? origin.y - size.height / 2 : origin.y + Math.floor(index / 3) * 344,
          },
          src: refs[index],
          width: size.width,
          height: size.height,
          alt: image.name,
        };
      });

      useCanvasStore.getState().addImages(specs);
      if (loaded.length > 1) toast(`Added ${loaded.length} images.`, "success");
      if (rejected) {
        toast(
          rejected.reason instanceof Error ? rejected.reason.message : "Some files were skipped.",
          "error",
        );
      }
      if (files.length > selected.length) {
        toast(`Only the first ${selected.length} images were added.`, "info");
      }
    },
    [screenToFlowPosition],
  );

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const files: File[] = [];
      const items = event.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length === 0 && event.clipboardData?.files?.length) {
        for (const file of Array.from(event.clipboardData.files)) {
          if (file.type.startsWith("image/")) files.push(file);
        }
      }
      if (files.length === 0) return;
      event.preventDefault();
      void importImages(files, mouseRef.current);
    };
    const clearDragOver = () => setDragOver(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", clearDragOver);
    window.addEventListener("dragend", clearDragOver);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drop", clearDragOver);
      window.removeEventListener("dragend", clearDragOver);
    };
  }, [importImages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "0") {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 });
        return;
      }
      if (!mod && !event.shiftKey && event.key.toLowerCase() === "f") {
        const selected = useCanvasStore.getState().nodes.filter((node) => node.selected);
        if (selected.length === 0) return;
        event.preventDefault();
        fitView({
          nodes: selected.map((node) => ({ id: node.id })),
          padding: 0.4,
          duration: 300,
          maxZoom: 1.25,
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitView]);

  // Keep browser page zoom out of the way; the canvas handles its own zoom.
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const zoomKeys = new Set(["+", "=", "-", "_", "0"]);
    const handleZoomKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && zoomKeys.has(event.key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleZoomKeyDown);
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleZoomKeyDown);
    };
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const zoom = flowStore.getState().transform[2] || 1;
      storeOnNodesChange(snapDragChanges(changes, useCanvasStore.getState().nodes, zoom));
    },
    [flowStore, storeOnNodesChange],
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        ".canvas-controls, .statusbar, .selection-toolbar, .edge-toolbar, .context-menu, .command-backdrop, .modal-backdrop, .react-flow__panel",
      )
    ) {
      setDragOver(false);
      return;
    }
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        ".canvas-controls, .statusbar, .selection-toolbar, .edge-toolbar, .context-menu, .command-backdrop, .modal-backdrop, .react-flow__panel",
      )
    ) {
      return;
    }
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      useToastStore.getState().push("Drop image files to add them to the canvas.", "error");
      return;
    }
    void importImages(images, { x: event.clientX, y: event.clientY });
  };

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".react-flow__node, .react-flow__edge, .react-flow__panel, .react-flow__controls, .react-flow__minimap, .statusbar, .canvas-controls, .context-menu, .selection-toolbar, .empty-state",
      )
    ) {
      return;
    }
    addNote(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const openMenu = (event: MouseEvent, targetIds: string[]) => {
    event.preventDefault();
    const targetNodes = targetIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node));
    setMenu({
      x: event.clientX,
      y: event.clientY,
      flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      targetIds,
      hasGroup: targetNodes.some((node) => node.type === "group"),
    });
  };

  const handlePaneContextMenu = (event: MouseEvent | globalThis.MouseEvent) => {
    openMenu(event as MouseEvent, []);
  };

  const handleNodeContextMenu = (event: MouseEvent, node: CanvasNode) => {
    const selected = nodes.filter((item) => item.selected).map((item) => item.id);
    openMenu(event, node.selected && selected.length > 0 ? selected : [node.id]);
  };

  const handleNodeDragStart: OnNodeDrag<CanvasNode> = useCallback(
    (_event, node) => {
      commit();
      raiseNode(node.id);
    },
    [commit, raiseNode],
  );

  const handleNodeDrag: OnNodeDrag<CanvasNode> = useCallback(
    () => {
      const zoom = flowStore.getState().transform[2] || 1;
      setGuides(computeGuidesForDragging(useCanvasStore.getState().nodes, zoom));
    },
    [flowStore],
  );

  const handleNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (_event, _node, draggedNodes) => {
      setGuides([]);
      // Dragging a group moves its children; it never enters another group.
      if (draggedNodes.some((node) => node.type === "group")) return;

      for (const dragged of draggedNodes) {
        const state = useCanvasStore.getState();
        const index = byId(state.nodes);
        const live = index.get(dragged.id);
        if (!live) continue;

        const rect = nodeRect(live, index);
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const currentParent = live.parentId ?? null;

        // Pick the smallest containing group so nested groups behave sensibly.
        let target: CanvasNode | null = null;
        let targetArea = Number.POSITIVE_INFINITY;
        for (const candidate of state.nodes) {
          if (candidate.type !== "group" || candidate.id === currentParent) continue;
          const groupRect = nodeRect(candidate, index);
          const inside =
            centerX >= groupRect.x &&
            centerX <= groupRect.x + groupRect.width &&
            centerY >= groupRect.y &&
            centerY <= groupRect.y + groupRect.height;
          if (!inside) continue;
          const area = groupRect.width * groupRect.height;
          if (area < targetArea) {
            target = candidate;
            targetArea = area;
          }
        }

        if (target) {
          state.reparentNode(live.id, target.id);
          continue;
        }

        if (currentParent) {
          const parent = index.get(currentParent);
          if (!parent) {
            state.reparentNode(live.id, null);
            continue;
          }
          const parentRect = nodeRect(parent, index);
          const inside =
            centerX >= parentRect.x &&
            centerX <= parentRect.x + parentRect.width &&
            centerY >= parentRect.y &&
            centerY <= parentRect.y + parentRect.height;
          if (!inside) state.reparentNode(live.id, null);
        }
      }
    },
    [],
  );

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
        onNodeClick={(_event, node) => raiseNode(node.id)}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => setGuides([])}
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
        connectionLineStyle={{ stroke: "#8b5cf6", strokeWidth: 2 }}
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
              const color = (node.data as { color?: NoteColor } | undefined)?.color;
              return color ? NOTE_COLORS[color] : "#5b6478";
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
            <strong>Drop images to add nodes</strong>
            <span>PNG, JPG, GIF or WebP · up to 4 MB each</span>
          </div>
        </div>
      ) : null}
      <CanvasControls />
      <EmptyState />
      <SelectionToolbar />
      <EdgeToolbar />
      <CommandPalette />
      {menu ? (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onFitView={() => fitView({ padding: 0.2, duration: 300 })}
        />
      ) : null}
      <StatusBar />
    </div>
  );
}
