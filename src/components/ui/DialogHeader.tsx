import type { ReactNode } from "react";
import { Button } from "./Button";

type DialogHeaderProps = {
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
};

export function DialogHeader({
  id,
  title,
  description,
  actions,
  onClose,
  className,
}: DialogHeaderProps) {
  return (
    <header className={className ? `dialog-head ${className}` : "dialog-head"}>
      <div className="dialog-head-copy">
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions}
      {onClose ? (
        <Button size="sm" icon aria-label="关闭" onClick={onClose}>
          ×
        </Button>
      ) : null}
    </header>
  );
}
