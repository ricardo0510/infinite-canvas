import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRequestError, aiRequest } from "./http";

function response(body: unknown, status = 200) {
  return {
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  sessionStorage.setItem("ic:ai-api-base", "https://api.example.com/v1");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("aiRequest", () => {
  it("unwraps a successful envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ code: 0, message: "ok", data: { value: 42 } })),
    );
    await expect(aiRequest<{ value: number }>("/test")).resolves.toEqual({ value: 42 });
  });

  it("throws the business error with code and data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({ code: 20001, message: "bad input", data: { field: "prompt" } }, 422),
      ),
    );
    await expect(aiRequest("/test")).rejects.toMatchObject({
      code: 20001,
      message: "bad input",
      data: { field: "prompt" },
      status: 422,
    });
  });

  it("rejects an invalid envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ data: 1 })));
    await expect(aiRequest("/test")).rejects.toBeInstanceOf(AiRequestError);
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, text: async () => "" } as Response));
    await expect(aiRequest("/test")).resolves.toBeUndefined();
  });
});
