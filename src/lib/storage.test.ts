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
    expect(snapshot?.nodes[0].type).toBe("text");
    expect(snapshot?.nodes[0].data).toMatchObject({
      title: "Hello",
      text: "World",
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
    expect(snapshot?.nodes[0].data).toEqual({ title: "Image", src: "", alt: "x" });
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
    expect(snapshot?.nodes[0].width).toBe(280);
    expect(snapshot?.nodes[0].height).toBe(160);
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

  it("migrates the v2 localStorage key to the current schema", () => {
    localStorage.clear();
    localStorage.setItem(
      "infinite-canvas:v2",
      JSON.stringify({
        version: 2,
        nodes: [{ id: "a", type: "note", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      }),
    );
    expect(loadSnapshot()?.version).toBe(SCHEMA_VERSION);
    expect(localStorage.getItem("infinite-canvas:v5")).not.toBeNull();
    expect(localStorage.getItem("infinite-canvas:v2")).toBeNull();
    localStorage.clear();
  });
});

describe("video nodes", () => {
  it("keeps video sources and generation results through validation", () => {
    const snapshot = migrateSnapshot({
      version: 3,
      nodes: [
        {
          id: "video-1",
          type: "video",
          position: { x: 0, y: 0 },
          data: {
            src: "https://cdn.example.com/a.mp4",
            thumbnailUrl: "https://cdn.example.com/a.jpg",
            alt: "clip",
            generation: {
              kind: "video",
              prompt: "waves",
              modelId: "m1",
              status: "succeeded",
              results: [
                {
                  id: "r1",
                  kind: "video",
                  url: "https://cdn.example.com/a.mp4",
                  thumbnailUrl: "https://cdn.example.com/a.jpg",
                  duration: 5,
                  modelId: "m1",
                  createdAt: "2026-10-29T08:00:00Z",
                },
              ],
              activeResultId: "r1",
            },
          },
        },
      ],
      edges: [],
    });
    expect(snapshot?.nodes[0].type).toBe("video");
    expect(snapshot?.nodes[0].data).toMatchObject({
      src: "https://cdn.example.com/a.mp4",
      thumbnailUrl: "https://cdn.example.com/a.jpg",
      alt: "clip",
    });
    const node = snapshot?.nodes[0];
    const generation = (node?.data as { generation?: { results?: unknown[] } } | undefined)?.generation;
    expect(generation?.results).toHaveLength(1);
  });

  it("drops unsafe generation urls and unknown statuses", () => {
    const snapshot = migrateSnapshot({
      version: 3,
      nodes: [
        {
          id: "image-1",
          type: "image",
          position: { x: 0, y: 0 },
          data: {
            src: "",
            alt: "",
            generation: {
              kind: "image",
              prompt: "x",
              modelId: "m1",
              status: "nonsense",
              results: [{ id: "r1", kind: "image", url: "javascript:alert(1)", modelId: "m1", createdAt: "" }],
            },
          },
        },
      ],
      edges: [],
    });
    const node = snapshot?.nodes[0];
    const generation = (node?.data as { generation?: unknown } | undefined)?.generation;
    expect(generation).toBeUndefined();
  });
});

describe("sanitizeImageSrc", () => {
  it("allows https, blob, image data urls and IndexedDB refs", () => {
    expect(sanitizeImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(sanitizeImageSrc("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(sanitizeImageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(sanitizeImageSrc("idb:0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(
      "idb:0f8fad5b-d9cb-469f-a165-70867728950e",
    );
  });

  it("rejects other protocols and empty values", () => {
    expect(sanitizeImageSrc("http://example.com/a.png")).toBe("");
    expect(sanitizeImageSrc("javascript:alert(1)")).toBe("");
    expect(sanitizeImageSrc("idb:has spaces")).toBe("");
    expect(sanitizeImageSrc(42)).toBe("");
    expect(sanitizeImageSrc("")).toBe("");
  });
});

describe("parseSnapshot", () => {
  it("is an alias of migrateSnapshot", () => {
    expect(parseSnapshot(v1)).toEqual(migrateSnapshot(v1));
  });
});
