import { describe, expect, it } from "vitest";
import { generateApiToken, hashApiToken } from "./api-token";

describe("api tokens", () => {
  it("generates prefixed, non-repeating tokens", () => {
    const first = generateApiToken();
    const second = generateApiToken();
    expect(first.startsWith("ic_")).toBe(true);
    expect(first.length).toBeGreaterThan(40);
    expect(first).not.toBe(second);
  });

  it("hashes tokens deterministically", () => {
    const hash = hashApiToken("ic_example");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiToken("ic_example")).toBe(hash);
    expect(hashApiToken("ic_other")).not.toBe(hash);
  });
});
