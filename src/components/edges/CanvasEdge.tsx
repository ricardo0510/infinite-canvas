import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useCallback, useState, type CSSProperties, type MouseEvent } from "react";
import { useCanvasStore } from "../../store/canvasStore";
import { Button } from "../ui/Button";

type Point = { x: number; y: number };

function getClosestPointOnPath(path: SVGPathElement, point: Point): Point | null {
  if (typeof path.getTotalLength !== "function" || typeof path.getPointAtLength !== "function") {
    return null;
  }
  let total = 0;
  try {
    total = path.getTotalLength();
  } catch {
    return null;
  }
  if (!total) return null;

  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= 48; index++) {
    const candidate = path.getPointAtLength((total * index) / 48);
    const dx = candidate.x - point.x;
    const dy = candidate.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: candidate.x, y: candidate.y };
    }
  }
  return best;
}

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
  const { screenToFlowPosition } = useReactFlow();
  const removeEdge = useCanvasStore((state) => state.removeEdge);
  const [edgeHovered, setEdgeHovered] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const baseWidth = (style?.strokeWidth as number | undefined) ?? 1.5;
  const pathStyle: CSSProperties = {
    ...style,
    strokeWidth: selected ? 3 : edgeHovered ? 2.5 : baseWidth,
  };
  const showButton = selected || edgeHovered || buttonHovered;
  const showLabel = Boolean(label);
  const buttonX = hoverPoint?.x ?? labelX;
  const buttonY = hoverPoint?.y ?? labelY;

  const handleMouseMove = useCallback(
    (event: MouseEvent<SVGGElement>) => {
      const pathElement = event.currentTarget.querySelector<SVGPathElement>(".react-flow__edge-path");
      if (!pathElement) return;
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const nearest = getClosestPointOnPath(pathElement, flowPoint);
      if (!nearest) return;
      setHoverPoint((current) =>
        current && Math.abs(current.x - nearest.x) < 1 && Math.abs(current.y - nearest.y) < 1
          ? current
          : nearest,
      );
    },
    [screenToFlowPosition],
  );

  return (
    <g
      onMouseEnter={() => setEdgeHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setEdgeHovered(false)}
    >
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
              transform: `translate(-50%, -50%) translate(${buttonX}px, ${buttonY}px)`,
            }}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
          >
            <Button
              variant="danger"
              size="xs"
              icon
              className="edge-delete"
              aria-label="删除连线"
              title="删除连线"
              onClick={(event) => {
                event.stopPropagation();
                removeEdge(id);
              }}
            >
              ×
            </Button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}
