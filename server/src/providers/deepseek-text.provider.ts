import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAICompatibleAdapter } from "../providers/adapters/openai-compatible.adapter";
import type { ProviderContext, TextInput, TextOutput } from "../providers/provider-adapter";

/**
 * 平台 DeepSeek 模型的薄封装：请求和解析复用 OpenAI 兼容适配器，
 * 这里只负责读取环境变量并组装 ProviderContext。
 */
@Injectable()
export class DeepSeekTextProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly adapter: OpenAICompatibleAdapter,
  ) {
    this.apiKey = config.get<string>("DEEPSEEK_API_KEY")?.trim() ?? "";
    this.baseUrl = (config.get<string>("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(
      /\/+$/,
      "",
    );
    this.modelId = config.get<string>("DEEPSEEK_MODEL")?.trim() || "deepseek-flash";
    this.timeoutMs = Number(config.get<string>("DEEPSEEK_TIMEOUT_MS") ?? 120_000);
  }

  model(): string {
    return this.modelId;
  }

  isModel(modelId: string): boolean {
    return modelId === this.modelId;
  }

  async generate(input: Omit<TextInput, "model">): Promise<TextOutput> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }
    const context: ProviderContext = {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      authType: "bearer",
      timeoutMs: this.timeoutMs,
    };
    return this.adapter.generateText(context, { model: this.modelId, ...input });
  }
}
