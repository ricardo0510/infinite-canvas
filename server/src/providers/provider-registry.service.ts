import { Injectable } from "@nestjs/common";
import type { ProviderAdapter } from "./provider-adapter";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible.adapter";

@Injectable()
export class ProviderRegistry {
  private readonly adapters: Record<string, ProviderAdapter>;

  constructor(openaiCompatible: OpenAICompatibleAdapter) {
    this.adapters = {
      "openai-compatible": openaiCompatible,
      deepseek: openaiCompatible,
      openai: openaiCompatible,
      siliconflow: openaiCompatible,
    };
  }

  get(adapter: string): ProviderAdapter {
    return this.adapters[adapter] ?? this.adapters["openai-compatible"];
  }
}
