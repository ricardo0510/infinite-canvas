import { useEffect, type RefObject } from "react";

/**
 * 为 role="menu" 容器提供方向键导航。
 * 打开时聚焦第一个可用菜单项，Home/End 跳到首尾。
 */
export function useMenuKeyboard(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const items = () =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])'));

    items()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const list = items();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        list[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        list[list.length - 1].focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [active, ref]);
}
