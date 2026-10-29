import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { DeepSeekTextProvider } from "./deepseek-text.provider";

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function provider(values: Record<string, string> = {}): DeepSeekTextProvider {
  return new DeepSeekTextProvider(
    config({
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_BASE_URL: "https://deepseek.test",
      DEEPSEEK_MODEL: "deepseek-4.1-flash",
      DEEPSEEK_TIMEOUT_MS: "5000",
      ...values,
    }),
  );
}

describe("DeepSeekTextProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps an OpenAI-compatible chat completion to text and usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: "你好，这是 DeepSeek 的回复。" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider().generate({
      prompt: "你好",
      systemPrompt: "简洁回答",
      temperature: 0.5,
      maxOutputTokens: 128,
    });

    expect(result.text).toBe("你好，这是 DeepSeek 的回复。");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 8 });
    expect(result.finishReason).toBe("stop");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://deepseek.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "deepseek-4.1-flash",
      stream: false,
      max_tokens: 128,
      temperature: 0.5,
    });
  });

  it("rejects when the upstream returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid api key", { status: 401 })),
    );

    await expect(provider().generate({ prompt: "你好" })).rejects.toThrow(
      "DeepSeek 请求失败（HTTP 401）",
    );
  });

  it("reports the configured model id", () => {
    const instance = provider();
    expect(instance.model()).toBe("deepseek-4.1-flash");
    expect(instance.isModel("deepseek-4.1-flash")).toBe(true);
    expect(instance.isModel("mock-text")).toBe(false);
  });
});
