import { describe, expect, it } from "vitest";
import { blobToDataUrl, imageIdFromRef, isIdbImageRef } from "./imageStore";

describe("image refs", () => {
  it("recognizes IndexedDB refs only", () => {
    expect(isIdbImageRef("idb:abc-123")).toBe(true);
    expect(imageIdFromRef("idb:abc-123")).toBe("abc-123");
    expect(isIdbImageRef("data:image/png;base64,AAAA")).toBe(false);
    expect(isIdbImageRef("https://example.com/a.png")).toBe(false);
    expect(imageIdFromRef("https://example.com/a.png")).toBeNull();
  });
});

describe("blobToDataUrl", () => {
  it("encodes a blob as a data URL", async () => {
    const url = await blobToDataUrl(new Blob(["hi"], { type: "text/plain" }));
    expect(url).toBe("data:text/plain;base64,aGk=");
  });
});
