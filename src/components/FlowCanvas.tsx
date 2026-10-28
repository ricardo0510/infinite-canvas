import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import type { MouseEvent } from "react";
import { NOTE_COLORS, useCanvasStore } from "../store/canvasStore";
import type { NoteColor } from "../types";
import { NoteNode } from "./nodes/NoteNode";
import { StatusBar } from "./StatusBar";

const nodeTypes = { note: NoteNode } satisfies NodeTypes;

const edgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { stroke: "#5b6478", strokeWidth: 1.5 },
};

export function FlowCanvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const commit = useCanvasStore((state) => state.commit);
  const addNote = useCanvasStore((state) => state.addNote);
  const { screenToFlowPosition } = useReactFlow();

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".react-flow__node, .react-flow__edge, .react-flow__panel, .react-flow__controls, .react-flow__minimap, .statusbar",
      )
    ) {
      return;
    }
    addNote(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  return (
    <div className="canvas" onDoubleClick={handleDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={() => commit()}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.25 }}
        minZoom={0.15}
        maxZoom={2}
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionKeyCode={null}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={edgeOptions}
        connectionLineStyle={{ stroke: "#8b5cf6", strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a3040" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(8, 10, 15, 0.72)"
          nodeStrokeWidth={2}
          nodeColor={(node) => NOTE_COLORS[node.data?.color as NoteColor] ?? "#5b6478"}
        />
      </ReactFlow>
      <StatusBar />
    </div>
  );
}
