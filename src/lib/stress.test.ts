import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./storage";
import { buildStressSnapshot } from "./stress";

describe("buildStressSnapshot", () => {
  it("builds a connected grid with unique ids", () => {
    const snapshot = buildStressSnapshot(20);
    expect(snapshot.version).toBe(SCHEMA_VERSION);
    expect(snapshot.nodes).toHaveLength(20);
    expect(snapshot.edges).toHaveLength(19);
    expect(new Set(snapshot.nodes.map((node) => node.id)).size).toBe(20);

    const ids = new Set(snapshot.nodes.map((node) => node.id));
    expect(snapshot.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
    expect(snapshot.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("clamps the requested size", () => {
    expect(buildStressSnapshot(0).nodes).toHaveLength(1);
    expect(buildStressSnapshot(10_000).nodes).toHaveLength(3000);
  });
});
