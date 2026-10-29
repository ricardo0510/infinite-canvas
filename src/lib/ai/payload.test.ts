import { describe, expect, it } from "vitest";
import { buildImageBody, buildTextBody, buildVideoBody, resolveImageMode, resolveVideoMode } from "./payload";
import type { GenerateInput } from "./types";

function input(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    nodeId: "n1",
    kind: "image",
    prompt: "a cat",
    modelId: "m1",
    params: { aspectRatio: "1:1", resolution: "1k", count: 1 },
    references: [],
    clientRequestId: "n1:req1",
    ...overrides,
  };
}

describe("generation payloads", () => {
  it("switches image mode when a reference exists", () => {
    expect(resolveImageMode(input())).toBe("textToImage");
    expect(
      resolveImageMode(
        input({ references: [{ type: "reference", url: "https://example.com/a.png" }] }),
      ),
    ).toBe("imageToImage");
  });

  it("keeps the explicit image mode", () => {
    expect(resolveImageMode(input({ mode: "textToImage", references: [{ type: "reference", url: "https://example.com/a.png" }] }))).toBe(
      "textToImage",
    );
  });

  it("resolves video modes from references", () => {
    expect(resolveVideoMode(input({ kind: "video" }))).toBe("textToVideo");
    expect(
      resolveVideoMode(
        input({ kind: "video", references: [{ type: "referenceImage", url: "https://example.com/a.png" }] }),
      ),
    ).toBe("imageToVideo");
    expect(
      resolveVideoMode(
        input({
          kind: "video",
          references: [
            { type: "firstFrame", url: "https://example.com/a.png" },
            { type: "lastFrame", url: "https://example.com/b.png" },
          ],
        }),
      ),
    ).toBe("firstLastFrame");
  });

  it("builds an image body with prompt and references", () => {
    const body = buildImageBody(
      input({
        mode: "imageToImage",
        references: [{ type: "reference", url: "https://example.com/a.png", assetId: "asset1" }],
      }),
    );
    expect(body).toMatchObject({
      modelId: "m1",
      mode: "imageToImage",
      prompt: "a cat",
      references: [{ type: "reference", url: "https://example.com/a.png", assetId: "asset1" }],
    });
    expect(body.params).toMatchObject({ count: 1, aspectRatio: "1:1" });
  });

  it("builds a video body with frame references", () => {
    const body = buildVideoBody(
      input({
        kind: "video",
        mode: "firstLastFrame",
        params: { aspectRatio: "16:9", resolution: "720p", duration: 5, generateAudio: true },
        references: [
          { type: "firstFrame", url: "https://example.com/a.png" },
          { type: "lastFrame", url: "https://example.com/b.png" },
        ],
      }),
    );
    expect(body).toMatchObject({
      mode: "firstLastFrame",
      references: [
        { type: "firstFrame", url: "https://example.com/a.png" },
        { type: "lastFrame", url: "https://example.com/b.png" },
      ],
    });
    expect(body.params).toMatchObject({ duration: 5, resolution: "720p", generateAudio: true });
  });

  it("builds a text body without media fields", () => {
    const body = buildTextBody(
      input({
        kind: "text",
        mode: undefined,
        params: { temperature: 0.2, maxOutputTokens: 128 },
      }),
    );
    expect(body).toEqual({
      modelId: "m1",
      prompt: "a cat",
      params: { temperature: 0.2, maxOutputTokens: 128 },
      clientRequestId: "n1:req1",
    });
  });
});
