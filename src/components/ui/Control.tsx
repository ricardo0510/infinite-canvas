import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

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

export function Textarea({
  controlSize = "md",
  variant = "default",
  className,
  ...rest
}: ComponentPropsWithRef<"textarea"> & ControlProps) {
  const classes = [controlClass(controlSize, variant, className), "control--area"].join(" ");
  return <textarea className={classes} {...rest} />;
}

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

type SelectProps = {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  controlSize?: ControlSize;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

const MENU_MAX_HEIGHT = 280;

export function Select({
  value,
  options,
  onChange,
  controlSize = "md",
  disabled = false,
  className,
  menuClassName,
  placeholder = "请选择",
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const openMenu = () => {
    if (disabled) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 168);
    const estimated = Math.min(options.length * 30 + 12, MENU_MAX_HEIGHT);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const placeAbove = below < estimated && above > below;
    const maxHeight = Math.max(96, Math.min(MENU_MAX_HEIGHT, placeAbove ? above : below));
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const height = Math.min(estimated, maxHeight);
    setPosition({
      left,
      top: placeAbove ? Math.max(8, rect.top - height - 6) : rect.bottom + 6,
      width,
      maxHeight,
    });
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
    triggerRef.current?.focus();
  };

  const move = (delta: number) => {
    if (options.length === 0) return;
    if (active < 0) {
      const start = delta > 0 ? 0 : options.length - 1;
      const order =
        delta > 0
          ? options.map((_, index) => index)
          : options.map((_, index) => index).reverse();
      const target = order.slice(order.indexOf(start)).find((index) => !options[index].disabled);
      if (target !== undefined) setActive(target);
      return;
    }
    let next = active;
    for (let step = 0; step < options.length; step += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) {
        setActive(next);
        return;
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    };
    const onReposition = () => close();
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (open) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const order = options.map((_, index) => index);
      if (event.key === "End") order.reverse();
      const target = order.find((index) => !options[index].disabled);
      if (target !== undefined) setActive(target);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  const classes = ["select", className].filter(Boolean).join(" ");
  const triggerClasses = [
    controlClass(controlSize, "default", "select-trigger"),
    open ? "is-open" : "",
    selected ? "" : "is-placeholder",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="select-value">{selected?.label ?? placeholder}</span>
        <svg className="select-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className={["select-menu", menuClassName].filter(Boolean).join(" ")}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              onKeyDown={onMenuKeyDown}
            >
              {options.length === 0 ? (
                <div className="select-empty">{placeholder}</div>
              ) : (
                options.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled}
                    data-index={index}
                    disabled={option.disabled}
                    className={[
                      "select-option",
                      index === active ? "is-active" : "",
                      option.value === value ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    <span className="select-option-label">{option.label}</span>
                    <span className="select-check">{option.value === value ? "✓" : ""}</span>
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
