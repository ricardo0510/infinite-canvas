import { ProgressBar, Spinner } from "../ui/Feedback";

type NodeLoadingOverlayProps = {
  label?: string;
  progress?: number;
};

export function NodeLoadingOverlay({ label = "生成中", progress }: NodeLoadingOverlayProps) {
  return (
    <div className="node-loading" aria-live="polite">
      <Spinner />
      <strong>{label}</strong>
      {progress !== undefined ? (
        <ProgressBar value={progress} className="node-loading-track" label={label} />
      ) : null}
    </div>
  );
}
