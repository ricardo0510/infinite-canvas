import { Handle, Position, useNodeConnections, useUpdateNodeInternals } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ErrorBanner } from "../ui/Feedback";
import { NodeLoadingOverlay } from "./NodeLoadingOverlay";
import { NodeTitleBar } from "./NodeTitleBar";

type NodeFrameProps = {
  id: string;
  title: string;
  defaultTitle: string;
  accent: string;
  kind: "text" | "image" | "video";
  selected: boolean;
  running: boolean;
  loadingLabel?: string;
  progress?: number;
  error?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

type Magnet = { side: "left" | "right"; x: number; y: number };

const MAGNET_RADIUS = 44;
const MAX_OFFSET = 26;

export function NodeFrame({
  id,
  title,
  defaultTitle,
  accent,
  kind,
  selected,
  running,
  loadingLabel,
  progress,
  error,
  actions,
  children,
}: NodeFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const targetConnections = useNodeConnections({ id, handleType: "target" });
  const sourceConnections = useNodeConnections({ id, handleType: "source" });
  const leftFixed = targetConnections.length > 0;
  const rightFixed = sourceConnections.length > 0;
  const [magnet, setMagnet] = useState<Magnet | null>(null);
  const magnetRef = useRef<Magnet | null>(null);
  const active = magnet !== null;

  useEffect(() => {
    const connectedSide =
      (magnet?.side === "left" && leftFixed) || (magnet?.side === "right" && rightFixed);
    if (connectedSide) return;
    updateNodeInternals(id);
  }, [id, leftFixed, magnet, rightFixed, updateNodeInternals]);

  const updateMagnet = useCallback(
    (clientX: number, clientY: number, keepSide: boolean) => {
      const apply = (next: Magnet | null) => {
        magnetRef.current = next;
        setMagnet(next);
      };
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1;
      const centerY = rect.top + rect.height / 2;

      const pointFor = (side: "left" | "right") => {
        const baseX = side === "left" ? rect.left : rect.right;
        const dx = clientX - baseX;
        const dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance > MAGNET_RADIUS) return null;
        const ratio = distance === 0 ? 0 : Math.min(distance, MAX_OFFSET) / distance;
        return {
          x: (baseX + dx * ratio - rect.left) / scale,
          y: (centerY + dy * ratio - rect.top) / scale,
        };
      };

      const current = magnetRef.current;
      if (keepSide && current) {
        const point = pointFor(current.side);
        if (!point) {
          apply(null);
          return;
        }
        apply({ side: current.side, ...point });
        return;
      }

      const candidates: { side: "left" | "right"; distance: number }[] = [
        { side: "left", distance: Math.hypot(clientX - rect.left, clientY - centerY) },
        { side: "right", distance: Math.hypot(clientX - rect.right, clientY - centerY) },
      ];
      const nearest = candidates.sort((left, right) => left.distance - right.distance)[0];
      if (!nearest || nearest.distance > MAGNET_RADIUS) return;
      const point = pointFor(nearest.side);
      if (point) apply({ side: nearest.side, ...point });
    },
    [],
  );

  useEffect(() => {
    if (!active) return;
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 0) return;
      updateMagnet(event.clientX, event.clientY, true);
    };
    const onPointerUp = () => {
      magnetRef.current = null;
      setMagnet(null);
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [active, updateMagnet]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 0) return;
    updateMagnet(event.clientX, event.clientY, Boolean(magnetRef.current));
  };

  const handleStyle = (side: "left" | "right") => {
    if (!magnet || magnet.side !== side) return undefined;
    return {
      left: magnet.x,
      top: magnet.y,
      right: "auto",
      transform: "translate(-50%, -50%)",
    };
  };

  return (
    <div
      ref={rootRef}
      className={`ai-node ai-node-${kind}${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": accent } as CSSProperties}
      onPointerMove={handlePointerMove}
    >
      <NodeTitleBar id={id} title={title} defaultTitle={defaultTitle} actions={actions} />
      <div className="node-handle-zone is-left nodrag nopan" onPointerMove={handlePointerMove} />
      <div className="node-handle-zone is-right nodrag nopan" onPointerMove={handlePointerMove} />
      <Handle type="target" position={Position.Left} className="node-handle" style={handleStyle("left")} />
      {running ? <NodeLoadingOverlay label={loadingLabel} progress={progress} /> : null}
      <div className="node-body nowheel">
        {children}
        {error ? <ErrorBanner className="node-error">{error}</ErrorBanner> : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle"
        style={handleStyle("right")}
      />
    </div>
  );
}
