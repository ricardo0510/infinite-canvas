import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
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
  return (
    <div
      className={`ai-node ai-node-${kind}${selected ? " is-selected" : ""}${running ? " is-running" : ""}`}
      style={{ "--node-accent": accent } as CSSProperties}
    >
      <NodeTitleBar id={id} title={title} defaultTitle={defaultTitle} actions={actions} />
      <Handle type="target" position={Position.Left} className="node-handle" />
      {running ? <NodeLoadingOverlay label={loadingLabel} progress={progress} /> : null}
      <div className="node-body nowheel">
        {children}
        {error ? (
          <p className="node-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
