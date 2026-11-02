import { describe, expect, it } from "vitest";
import { resolveImageSize } from "./openai-compatible.adapter";

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
