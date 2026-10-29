import type { NoteColor } from "../types";

/**
 * 单一颜色来源：与 src/styles/_tokens.scss 中的 --node-* 保持一致。
 * CSS 侧通过 --node-accent 注入，TS 侧直接读取这里。
 */
export const NOTE_COLORS: Record<NoteColor, string> = {
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  emerald: "#34d399",
};

export const DEFAULT_EDGE_STROKE = "#5b6478";
