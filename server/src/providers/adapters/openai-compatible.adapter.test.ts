import { describe, expect, it } from "vitest";
import { resolveImageSize, resolveVideoSize } from "./openai-compatible.adapter";

describe("resolveImageSize", () => {
  it("uses a square size for 1:1", () => {
    expect(resolveImageSize("1:1", "1k")).toEqual({ width: 1024, height: 1024 });
  });

  it("keeps the long side at the requested bucket", () => {
    expect(resolveImageSize("16:9", "1k")).toEqual({ width: 1024, height: 576 });
    expect(resolveImageSize("9:16", "2k")).toEqual({ width: 1152, height: 2048 });
  });

  it("falls back to a square for auto", () => {
    expect(resolveImageSize("auto", "auto")).toEqual({ width: 1024, height: 1024 });
  });
});

describe("resolveVideoSize", () => {
  it("maps SiliconFlow video aspect ratios", () => {
    expect(resolveVideoSize("16:9")).toEqual({ width: 1280, height: 720 });
    expect(resolveVideoSize("9:16")).toEqual({ width: 720, height: 1280 });
    expect(resolveVideoSize("1:1")).toEqual({ width: 960, height: 960 });
  });
});
