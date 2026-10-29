import type { ReactNode } from "react";

type ErrorBannerProps = {
  children: ReactNode;
  className?: string;
};

export function ErrorBanner({ children, className }: ErrorBannerProps) {
  return (
    <p className={className ? `error-banner ${className}` : "error-banner"} role="alert">
      {children}
    </p>
  );
}

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return <span className={className ? `spinner ${className}` : "spinner"} aria-hidden="true" />;
}

type ProgressBarProps = {
  value: number;
  label?: string;
  className?: string;
};

export function ProgressBar({ value, label = "生成进度", className }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, value));
  return (
    <div
      className={className ? `progress ${className}` : "progress"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
