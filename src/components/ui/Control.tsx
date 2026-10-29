import type { ComponentPropsWithRef } from "react";

type ControlSize = "xs" | "sm" | "md" | "lg";
type ControlVariant = "default" | "bare";

type ControlProps = {
  controlSize?: ControlSize;
  variant?: ControlVariant;
};

function controlClass(size: ControlSize, variant: ControlVariant, className?: string) {
  const classes = ["control", `control--${size}`];
  if (variant === "bare") classes.push("control--bare");
  if (className) classes.push(className);
  return classes.join(" ");
}

export function Input({
  controlSize = "md",
  variant = "default",
  className,
  ...rest
}: ComponentPropsWithRef<"input"> & ControlProps) {
  return <input className={controlClass(controlSize, variant, className)} {...rest} />;
}

export function Select({
  controlSize = "md",
  variant = "default",
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"select"> & ControlProps) {
  return (
    <select className={controlClass(controlSize, variant, className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  controlSize = "md",
  variant = "default",
  className,
  ...rest
}: ComponentPropsWithRef<"textarea"> & ControlProps) {
  const classes = [controlClass(controlSize, variant, className), "control--area"].join(" ");
  return <textarea className={classes} {...rest} />;
}
