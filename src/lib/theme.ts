import type { NoteColor } from "../types";

/**
 * 单一颜色来源：与 src/styles/_tokens.scss 中的 --node-* 保持一致。
 * CSS 侧通过 --node-accent 注入，TS 侧直接读取这里。
 */
export const NOTE_COLORS: Record<NoteColor, string> = {
  violet: "#5f6c7c",
  cyan: "#4f7773",
  amber: "#9a6c2f",
  emerald: "#5c6f47",
};

export const DEFAULT_EDGE_STROKE = "#6f6f66";
export const ACCENT = "#1b1b18";
