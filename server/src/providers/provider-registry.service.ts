import { Injectable } from "@nestjs/common";
import type { ProviderAdapter } from "./provider-adapter";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible.adapter";
import { ZhipuVideoAdapter } from "./adapters/zhipu-video.adapter";

@Injectable()
export class ProviderRegistry {
  private readonly adapters: Record<string, ProviderAdapter>;

  constructor(openaiCompatible: OpenAICompatibleAdapter, zhipu: ZhipuVideoAdapter) {
    this.adapters = {
      "openai-compatible": openaiCompatible,
      deepseek: openaiCompatible,
      openai: openaiCompatible,
      siliconflow: openaiCompatible,
      zhipu: zhipu,
    };
  }

  get(adapter: string): ProviderAdapter {
    return this.adapters[adapter] ?? this.adapters["openai-compatible"];
  }
}
