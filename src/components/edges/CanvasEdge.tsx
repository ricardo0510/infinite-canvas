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
  label,
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

  const baseWidth = (style?.strokeWidth as number | undefined) ?? 1.5;
  const pathStyle: CSSProperties = {
    ...style,
    strokeWidth: selected ? 3 : hovered ? 2.5 : baseWidth,
  };
  const showButton = hovered || Boolean(selected);
  const showLabel = Boolean(label);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={pathStyle}
        interactionWidth={interactionWidth ?? 24}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {showButton ? (
        <EdgeLabelRenderer>
          <div
            className="edge-delete-wrap nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 20}px)`,
            }}
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
