import { describe, expect, it } from "vitest";
import { fitImageSize } from "./images";

describe("fitImageSize", () => {
  it("scales large images into the 320px box", () => {
    expect(fitImageSize(400, 300)).toEqual({ width: 320, height: 240 });
    expect(fitImageSize(300, 400)).toEqual({ width: 240, height: 320 });
  });

  it("does not upscale normal images", () => {
    expect(fitImageSize(120, 80)).toEqual({ width: 140, height: 100 });
    expect(fitImageSize(260, 190)).toEqual({ width: 260, height: 190 });
  });

  it("clamps extreme aspect ratios to usable node sizes", () => {
    expect(fitImageSize(1000, 10)).toEqual({ width: 320, height: 100 });
    expect(fitImageSize(10, 1000)).toEqual({ width: 140, height: 320 });
  });

  it("falls back for invalid dimensions", () => {
    expect(fitImageSize(0, 0)).toEqual({ width: 280, height: 220 });
    expect(fitImageSize(Number.NaN, 10)).toEqual({ width: 280, height: 220 });
  });
});
