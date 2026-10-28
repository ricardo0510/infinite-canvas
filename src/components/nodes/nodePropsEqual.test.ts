import { describe, expect, it } from "vitest";
import { nodePropsEqual } from "./nodePropsEqual";

const base = {
  id: "n1",
  type: "note",
  selected: false,
  dragging: false,
  data: { title: "A" },
};

describe("nodePropsEqual", () => {
  it("ignores position and measured size changes", () => {
    expect(nodePropsEqual(base, { ...base })).toBe(true);
  });

  it("re-renders on data, selection or dragging changes", () => {
    expect(nodePropsEqual(base, { ...base, data: { title: "B" } })).toBe(false);
    expect(nodePropsEqual(base, { ...base, selected: true })).toBe(false);
    expect(nodePropsEqual(base, { ...base, dragging: true })).toBe(false);
  });
});
