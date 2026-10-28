import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { computeGuidesForDragging, snapDragChanges } from "./guides";

function note(
  id: string,
  x: number,
  y: number,
  extra: Partial<CanvasNode> = {},
): CanvasNode {
  return {
    id,
    type: "note",
    position: { x, y },
    data: { title: id, body: "", color: "violet" },
    width: 100,
    height: 50,
    ...extra,
  } as CanvasNode;
}

function move(id: string, x: number, y: number, dragging = true): NodeChange<CanvasNode> {
  return { id, type: "position", position: { x, y }, dragging };
}

describe("snapDragChanges", () => {
  it("snaps the dragged node to a nearby left edge", () => {
    const result = snapDragChanges(
      [move("a", 0, 0)],
      [note("a", 0, 0, { dragging: true }), note("b", 3, 0)],
      1,
    );
    expect(result[0]).toMatchObject({ position: { x: 3, y: 0 } });
  });

  it("does not snap beyond the screen-pixel threshold", () => {
    const result = snapDragChanges(
      [move("a", 0, 0)],
      [note("a", 0, 0, { dragging: true }), note("b", 20, 0)],
      1,
    );
    expect(result[0]).toMatchObject({ position: { x: 0, y: 0 } });
  });

  it("converts the threshold with the current zoom", () => {
    const near = [note("a", 0, 0, { dragging: true }), note("b", 2, 0)];
    expect(snapDragChanges([move("a", 0, 0)], near, 2)[0]).toMatchObject({
      position: { x: 2, y: 0 },
    });

    const far = [note("a", 0, 0, { dragging: true }), note("b", 5, 0)];
    expect(snapDragChanges([move("a", 0, 0)], far, 2)[0]).toMatchObject({
      position: { x: 0, y: 0 },
    });
  });

  it("snaps a multi-selection as one bounding box", () => {
    const target = { ...note("wide", 3, 0), width: 300 };
    const result = snapDragChanges(
      [move("a", 0, 0), move("b", 110, 0)],
      [note("a", 0, 0, { dragging: true }), note("b", 110, 0, { dragging: true }), target],
      1,
    );
    expect(result[0]).toMatchObject({ position: { x: 3, y: 0 } });
    expect(result[1]).toMatchObject({ position: { x: 113, y: 0 } });
  });

  it("does not snap a dragged group", () => {
    const group = note("g", 0, 0, { dragging: true, type: "group" } as Partial<CanvasNode>);
    const result = snapDragChanges([move("g", 0, 0)], [group, note("b", 3, 0)], 1);
    expect(result[0]).toMatchObject({ position: { x: 0, y: 0 } });
  });

  it("uses absolute coordinates for child nodes", () => {
    const parent = note("p", 100, 100);
    const child = note("c", 0, 0, { parentId: "p", dragging: true });
    const result = snapDragChanges(
      [move("c", 0, 0)],
      [parent, child, note("target", 103, 100)],
      1,
    );
    expect(result[0]).toMatchObject({ position: { x: 3, y: 0 } });
  });

  it("ignores non-position changes", () => {
    const changes: NodeChange<CanvasNode>[] = [{ id: "a", type: "select", selected: true }];
    expect(snapDragChanges(changes, [note("a", 0, 0)], 1)).toBe(changes);
  });
});

describe("computeGuidesForDragging", () => {
  it("returns a vertical guide when left edges line up", () => {
    const guides = computeGuidesForDragging(
      [note("a", 0, 0, { dragging: true }), note("b", 0, 200)],
      1,
    );
    expect(guides).toContainEqual({
      orientation: "vertical",
      position: 0,
      start: -18,
      end: 268,
    });
  });

  it("returns no guides when the dragging set is empty", () => {
    expect(computeGuidesForDragging([note("a", 0, 0), note("b", 0, 200)], 1)).toEqual([]);
  });

  it("ignores group containers as alignment targets", () => {
    const group = note("g", 0, 200, {
      type: "group",
      width: 320,
      height: 200,
    } as Partial<CanvasNode>);
    expect(computeGuidesForDragging([note("a", 0, 0, { dragging: true }), group], 1)).toEqual([]);
  });

  it("uses absolute coordinates for child nodes", () => {
    const parent = note("p", 100, 100);
    const child = note("c", 0, 0, { parentId: "p", dragging: true });
    const guides = computeGuidesForDragging([parent, child, note("b", 100, 300)], 1);
    expect(
      guides.some((guide) => guide.orientation === "vertical" && guide.position === 100),
    ).toBe(true);
  });
});
