import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useState, type CSSProperties } from "react";
import { useCanvasStore } from "../../store/canvasStore";

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  interactionWidth,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const removeEdge = useCanvasStore((state) => state.removeEdge);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const baseStroke = (style?.stroke as string | undefined) ?? "#5b6478";
  const baseWidth = (style?.strokeWidth as number | undefined) ?? 1.5;
  const pathStyle: CSSProperties = {
    ...style,
    stroke: selected ? "#8b5cf6" : hovered ? "#a78bfa" : baseStroke,
    strokeWidth: selected ? 2.5 : baseWidth,
  };
  const showButton = hovered || Boolean(selected);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={pathStyle}
        interactionWidth={interactionWidth ?? 24}
      />
      {showButton ? (
        <EdgeLabelRenderer>
          <div
            className="edge-delete-wrap nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              type="button"
              className="edge-delete"
              aria-label="Delete edge"
              title="Delete edge"
              onClick={(event) => {
                event.stopPropagation();
                removeEdge(id);
              }}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}
