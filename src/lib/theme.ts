import type { NoteColor } from "../types";

/**
 * 单一颜色来源：与 src/styles/_tokens.scss 中的 --node-* 保持一致。
 * CSS 侧通过 --node-accent 注入，TS 侧直接读取这里。
 */
export const NOTE_COLORS: Record<NoteColor, string> = {
  violet: "#8a94a6",
  cyan: "#7f9f9c",
  amber: "#c39a5a",
  emerald: "#8a9a72",
};

export const DEFAULT_EDGE_STROKE = "#7a766c";
export const ACCENT = "#d2a13f";
