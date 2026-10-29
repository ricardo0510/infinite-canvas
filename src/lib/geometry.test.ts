import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../types";
import {
  absolutePosition,
  boundsOf,
  byId,
  clampSize,
  descendantIds,
  nodeRect,
  nodeSize,
  snapValue,
} from "./geometry";

function note(id: string, x: number, y: number, extra: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id,
    type: "text",
    position: { x, y },
    data: { title: id, text: "", color: "violet", fontSize: 16 },
    width: 100,
    height: 50,
    ...extra,
  } as CanvasNode;
}

describe("snapValue", () => {
  it("rounds to the nearest grid step", () => {
    expect(snapValue(11)).toBe(8);
    expect(snapValue(13)).toBe(16);
    expect(snapValue(-11)).toBe(-8);
    expect(snapValue(17, 16)).toBe(16);
  });
});

describe("clampSize", () => {
  it("enforces each node kind minimum", () => {
    expect(clampSize("text", 10, 10)).toEqual({ width: 280, height: 160 });
    expect(clampSize("image", 500, 10)).toEqual({ width: 500, height: 160 });
  });
});

describe("nodeSize", () => {
  it("prefers explicit size, then measured, then defaults", () => {
    expect(nodeSize(note("a", 0, 0))).toEqual({ width: 100, height: 50 });
    expect(nodeSize(note("b", 0, 0, { width: undefined, height: undefined }))).toEqual({
      width: 280,
      height: 160,
    });
  });
});

describe("absolutePosition", () => {
  it("adds ancestor offsets", () => {
    const group = note("g", 100, 100);
    const child = note("c", 20, 30, { parentId: "g" });
    const grandchild = note("gc", 5, 5, { parentId: "c" });
    const index = byId([group, child, grandchild]);
    expect(absolutePosition(grandchild, index)).toEqual({ x: 125, y: 135 });
  });

  it("ignores cycles instead of looping forever", () => {
    const a = note("a", 1, 1, { parentId: "b" });
    const b = note("b", 2, 2, { parentId: "a" });
    const index = byId([a, b]);
    expect(absolutePosition(a, index)).toEqual({ x: 3, y: 3 });
  });
});

describe("nodeRect and boundsOf", () => {
  it("computes a bounding box from absolute rects", () => {
    const a = note("a", 0, 0);
    const b = note("b", 300, 120);
    const bounds = boundsOf([a, b]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 400, height: 170 });
    expect(nodeRect(b, byId([a, b]))).toEqual({ x: 300, y: 120, width: 100, height: 50 });
  });

  it("returns null for an empty selection", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("descendantIds", () => {
  it("includes nested children", () => {
    const group = note("g", 0, 0);
    const child = note("c", 0, 0, { parentId: "g" });
    const grandchild = note("gc", 0, 0, { parentId: "c" });
    const other = note("o", 0, 0);
    expect([...descendantIds(["g"], [group, child, grandchild, other])].sort()).toEqual([
      "c",
      "g",
      "gc",
    ]);
  });
});
