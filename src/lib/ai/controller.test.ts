import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../store/canvasStore";
import { generateNode, patchGeneration } from "./controller";

function reset() {
  sessionStorage.clear();
  useCanvasStore.setState({ nodes: [], edges: [], past: [], future: [], clipboard: null, viewport: null });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function generationOf(id: string) {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === id);
  return (node?.data as { generation?: { status?: string; prompt?: string } } | undefined)?.generation;
}

beforeEach(reset);
afterEach(reset);

describe("mock generation", () => {
  it("writes a completed text result", async () => {
    const id = useCanvasStore.getState().addNode("text", { x: 0, y: 0 });
    patchGeneration(id, {
      kind: "text",
      prompt: "Write a short idea",
      modelId: "mock-text",
      params: { temperature: 0.7 },
    });
    await generateNode(id);
    await wait(900);
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id);
    expect(node?.data).toMatchObject({ text: expect.stringContaining("模拟生成") });
    expect(generationOf(id)?.status).toBe("succeeded");
  });

  it("writes image results", async () => {
    const id = useCanvasStore.getState().addNode("image", { x: 0, y: 0 });
    patchGeneration(id, {
      kind: "image",
      prompt: "A neon city",
      modelId: "mock-image",
      params: { aspectRatio: "1:1", resolution: "1k", count: 1 },
    });
    await generateNode(id);
    await wait(1400);
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id);
    expect(node?.data.src).toMatch(/^data:image\/svg\+xml/);
    expect(generationOf(id)?.status).toBe("succeeded");
  });

  it("writes video results", async () => {
    const id = useCanvasStore.getState().addNode("video", { x: 0, y: 0 });
    patchGeneration(id, {
      kind: "video",
      prompt: "A slow camera push",
      modelId: "mock-video",
      mode: "textToVideo",
      params: { aspectRatio: "16:9", resolution: "720p", duration: 5 },
    });
    await generateNode(id);
    await wait(1600);
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id);
    expect(node?.data.src).toMatch(/^https:/);
    expect(generationOf(id)?.status).toBe("succeeded");
  });
});
