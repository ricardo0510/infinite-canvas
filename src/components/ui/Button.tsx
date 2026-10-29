import type { ButtonHTMLAttributes } from "react";

type ButtonVariant =
  | "secondary"
  | "ghost"
  | "accent"
  | "primary"
  | "danger"
  | "menu"
  | "card"
  | "tile"
  | "swatch";
type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  active?: boolean;
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon = false,
  active = false,
  block = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`];
  if (icon) classes.push("btn--icon");
  if (active) classes.push("is-active");
  if (block) classes.push("btn--block");
  if (className) classes.push(className);
  return <button type={type} className={classes.join(" ")} {...rest} />;
}
