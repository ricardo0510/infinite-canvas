import { describe, expect, it } from "vitest";
import { zhipuVideoSize } from "./zhipu-video.adapter";

describe("zhipuVideoSize", () => {
  it("maps CogVideoX-3 sizes", () => {
    expect(zhipuVideoSize("cogvideox-3", "16:9", "720p")).toBe("1280x720");
    expect(zhipuVideoSize("cogvideox-3", "16:9", "1080p")).toBe("1920x1080");
    expect(zhipuVideoSize("cogvideox-3", "16:9", "4k")).toBe("3840x2160");
    expect(zhipuVideoSize("cogvideox-3", "9:16", "720p")).toBe("720x1280");
  });

  it("maps CogVideoX Flash sizes", () => {
    expect(zhipuVideoSize("cogvideox-flash", "16:9", "1080p")).toBe("1920x1080");
    expect(zhipuVideoSize("cogvideox-flash", "9:16", "1080p")).toBe("1080x1920");
    expect(zhipuVideoSize("cogvideox-flash", "4:3", "1080p")).toBe("1280x960");
  });
});
