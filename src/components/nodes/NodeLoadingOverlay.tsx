type NodeLoadingOverlayProps = {
  label?: string;
  progress?: number;
};

export function NodeLoadingOverlay({ label = "生成中", progress }: NodeLoadingOverlayProps) {
  return (
    <div className="node-loading" aria-live="polite">
      <span className="node-loading-spinner" aria-hidden="true" />
      <strong>{label}</strong>
      {progress !== undefined ? (
        <span className="node-loading-track" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </span>
      ) : null}
    </div>
  );
}
