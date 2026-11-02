import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

type Magnet = { side: "left" | "right"; top: number };

const MAGNET_RADIUS = 84;

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
  const [magnet, setMagnet] = useState<Magnet | null>(null);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, magnet, updateNodeInternals]);

  useEffect(() => {
    const onPointerUp = () => setMagnet(null);
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 0) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerY = rect.height / 2;
    const leftDistance = Math.hypot(x, y - centerY);
    const rightDistance = Math.hypot(x - rect.width, y - centerY);
    let side: "left" | "right";
    if (magnet) {
      side = magnet.side;
    } else {
      if (Math.min(leftDistance, rightDistance) > MAGNET_RADIUS) return;
      side = leftDistance <= rightDistance ? "left" : "right";
    }
    const top = Math.min(88, Math.max(12, (y / rect.height) * 100));
    setMagnet((current) =>
      current && current.side === side && Math.abs(current.top - top) < 0.4
        ? current
        : { side, top },
    );
  };

  const handlePointerLeave = () => {
    setMagnet(null);
  };

  return (
    <div
      ref={rootRef}
      className={`ai-node ai-node-${kind}${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": accent } as CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <NodeTitleBar id={id} title={title} defaultTitle={defaultTitle} actions={actions} />
      <Handle
        type="target"
        position={Position.Left}
        className="node-handle"
        style={magnet?.side === "left" ? { top: `${magnet.top}%` } : undefined}
      />
      {running ? <NodeLoadingOverlay label={loadingLabel} progress={progress} /> : null}
      <div className="node-body nowheel">
        {children}
        {error ? <ErrorBanner className="node-error">{error}</ErrorBanner> : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle"
        style={magnet?.side === "right" ? { top: `${magnet.top}%` } : undefined}
      />
    </div>
  );
}
