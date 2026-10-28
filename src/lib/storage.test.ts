import { describe, expect, it } from "vitest";
import {
  loadSnapshot,
  migrateSnapshot,
  parseSnapshot,
  sanitizeImageSrc,
  saveSnapshot,
  SCHEMA_VERSION,
} from "./storage";

const v1 = {
  version: 1,
  nodes: [
    {
      id: "a",
      position: { x: 10, y: 20 },
      data: { title: "Hello", body: "World", color: "cyan" },
    },
  ],
  edges: [],
};

describe("migrateSnapshot", () => {
  it("upgrades a v1 snapshot to the current schema", () => {
    const snapshot = migrateSnapshot(v1);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.version).toBe(SCHEMA_VERSION);
    expect(snapshot?.nodes[0].type).toBe("note");
    expect(snapshot?.nodes[0].data).toMatchObject({
      title: "Hello",
      body: "World",
      color: "cyan",
    });
  });

  it("defaults a missing version to v1", () => {
    expect(migrateSnapshot({ nodes: v1.nodes, edges: v1.edges })?.version).toBe(SCHEMA_VERSION);
  });

  it("rejects snapshots from a newer schema", () => {
    expect(migrateSnapshot({ ...v1, version: SCHEMA_VERSION + 1 })).toBeNull();
  });

  it("rejects values without node and edge arrays", () => {
    expect(migrateSnapshot(null)).toBeNull();
    expect(migrateSnapshot({ nodes: [] })).toBeNull();
    expect(migrateSnapshot("nope")).toBeNull();
  });

  it("drops invalid nodes, dangling edges, and dangling parents", () => {
    const snapshot = migrateSnapshot({
      version: 2,
      nodes: [
        { id: "ok", type: "note", position: { x: 0, y: 0 }, data: { title: "A", body: "", color: "violet" } },
        { id: 42, position: { x: 0, y: 0 }, data: {} },
        { id: "orphan", position: { x: 0, y: 0 }, data: {}, parentId: "missing" },
      ],
      edges: [
        { id: "e1", source: "ok", target: "missing" },
        { id: "e2", source: "ok", target: "orphan" },
      ],
    });
    expect(snapshot?.nodes.map((node) => node.id)).toEqual(["ok", "orphan"]);
    expect(snapshot?.nodes[1].parentId).toBeUndefined();
    expect(snapshot?.edges.map((edge) => edge.id)).toEqual(["e2"]);
  });

  it("drops unknown fields and unsafe image sources", () => {
    const snapshot = migrateSnapshot({
      version: 2,
      nodes: [
        {
          id: "img",
          type: "image",
          position: { x: 0, y: 0 },
          data: { src: "javascript:alert(1)", alt: "x", evil: true },
          malicious: "field",
        },
      ],
      edges: [],
    });
    expect(snapshot?.nodes[0].data).toEqual({ src: "", alt: "x" });
    expect(snapshot?.nodes[0]).not.toHaveProperty("malicious");
  });

  it("keeps explicit node sizes", () => {
    const snapshot = migrateSnapshot({
      version: 2,
      nodes: [
        {
          id: "n",
          type: "note",
          position: { x: 0, y: 0 },
          data: { title: "A", body: "", color: "violet" },
          width: 320,
          height: 200,
        },
      ],
      edges: [],
    });
    expect(snapshot?.nodes[0].width).toBe(320);
    expect(snapshot?.nodes[0].height).toBe(200);
  });

  it("gives nodes without a size the default for their kind", () => {
    const snapshot = migrateSnapshot(v1);
    expect(snapshot?.nodes[0].width).toBe(260);
    expect(snapshot?.nodes[0].height).toBe(190);
  });
});

describe("edge styling", () => {
  it("keeps label, dash pattern and marker through validation", () => {
    const snapshot = migrateSnapshot({
      version: 2,
      nodes: [
        { id: "a", type: "note", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "note", position: { x: 300, y: 0 }, data: {} },
      ],
      edges: [
        {
          id: "e1",
          source: "a",
          target: "b",
          label: "flow",
          style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 4" },
          markerEnd: { type: "arrowclosed", width: 16, height: 16, color: "#f59e0b" },
        },
      ],
    });
    expect(snapshot?.edges[0]).toMatchObject({
      label: "flow",
      style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "6 4" },
      markerEnd: { type: "arrowclosed", width: 16, height: 16, color: "#f59e0b" },
    });
  });
});

describe("viewport persistence", () => {
  it("round-trips a valid viewport through localStorage", () => {
    localStorage.clear();
    saveSnapshot({
      version: SCHEMA_VERSION,
      nodes: [],
      edges: [],
      viewport: { x: 12, y: -8, zoom: 1.25 },
    });
    expect(loadSnapshot()?.viewport).toEqual({ x: 12, y: -8, zoom: 1.25 });
    localStorage.clear();
  });

  it("drops an invalid viewport", () => {
    const snapshot = migrateSnapshot({ version: 2, nodes: [], edges: [], viewport: { zoom: 0 } });
    expect(snapshot?.viewport).toBeUndefined();
  });
});

describe("sanitizeImageSrc", () => {
  it("allows https, blob, and image data urls", () => {
    expect(sanitizeImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(sanitizeImageSrc("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(sanitizeImageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("rejects other protocols and empty values", () => {
    expect(sanitizeImageSrc("http://example.com/a.png")).toBe("");
    expect(sanitizeImageSrc("javascript:alert(1)")).toBe("");
    expect(sanitizeImageSrc(42)).toBe("");
    expect(sanitizeImageSrc("")).toBe("");
  });
});

describe("parseSnapshot", () => {
  it("is an alias of migrateSnapshot", () => {
    expect(parseSnapshot(v1)).toEqual(migrateSnapshot(v1));
  });
});
