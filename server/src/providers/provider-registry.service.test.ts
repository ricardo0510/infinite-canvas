import { describe, expect, it } from "vitest";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible.adapter";
import { ZhipuVideoAdapter } from "./adapters/zhipu-video.adapter";
import { ProviderRegistry } from "./provider-registry.service";

function createRegistry(): ProviderRegistry {
  return new ProviderRegistry(new OpenAICompatibleAdapter(), new ZhipuVideoAdapter());
}

describe("ProviderRegistry", () => {
  it("resolves the configured adapter names", () => {
    const registry = createRegistry();
    expect(registry.get("zhipu")).toBeInstanceOf(ZhipuVideoAdapter);
    expect(registry.get("openai")).toBeInstanceOf(OpenAICompatibleAdapter);
  });

  it("rejects an unknown adapter instead of silently falling back", () => {
    expect(() => createRegistry().get("zhipu-video")).toThrow("未知的供应商适配器");
  });
});
