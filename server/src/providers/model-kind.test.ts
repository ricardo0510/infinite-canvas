import { describe, expect, it } from "vitest";
import { inferModelKind, isSupportedUpstreamModel } from "./model-kind";

describe("inferModelKind", () => {
  it("keeps chat models as text", () => {
    expect(inferModelKind("gpt-4o")).toBe("text");
    expect(inferModelKind("deepseek-chat")).toBe("text");
    expect(inferModelKind("qwen2.5-72b-instruct")).toBe("text");
  });

  it("detects image models", () => {
    expect(inferModelKind("dall-e-3")).toBe("image");
    expect(inferModelKind("gpt-image-1")).toBe("image");
    expect(inferModelKind("flux-1.1-pro")).toBe("image");
  });

  it("detects video models", () => {
    expect(inferModelKind("sora-1")).toBe("video");
    expect(inferModelKind("veo-3")).toBe("video");
    expect(inferModelKind("kling-v2")).toBe("video");
    expect(inferModelKind("wan2.1-t2v")).toBe("video");
  });

  it("skips non-generation models", () => {
    expect(isSupportedUpstreamModel("text-embedding-3-large")).toBe(false);
    expect(isSupportedUpstreamModel("whisper-1")).toBe(false);
    expect(isSupportedUpstreamModel("tts-1")).toBe(false);
    expect(isSupportedUpstreamModel("gpt-4o")).toBe(true);
  });
});
