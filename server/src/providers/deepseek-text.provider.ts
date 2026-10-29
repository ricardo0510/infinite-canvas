import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type DeepSeekTextResult = {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
};

type ChatCompletion = {
  choices?: {
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

@Injectable()
export class DeepSeekTextProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("DEEPSEEK_API_KEY")?.trim() ?? "";
    this.baseUrl = (config.get<string>("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(
      /\/+$/,
      "",
    );
    this.modelId = config.get<string>("DEEPSEEK_MODEL")?.trim() || "deepseek-4.1-flash";
    this.timeoutMs = Number(config.get<string>("DEEPSEEK_TIMEOUT_MS") ?? 120_000);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  model(): string {
    return this.modelId;
  }

  isModel(modelId: string): boolean {
    return modelId === this.modelId;
  }

  async generate(input: {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<DeepSeekTextResult> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (input.systemPrompt?.trim()) {
      messages.push({ role: "system", content: input.systemPrompt.trim() });
    }
    messages.push({ role: "user", content: input.prompt });

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      stream: false,
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.maxOutputTokens !== undefined) body.max_tokens = input.maxOutputTokens;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`DeepSeek 请求超时（${Math.round(this.timeoutMs / 1000)}s）`);
      }
      throw error;
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `DeepSeek 请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`,
      );
    }

    const data = (await response.json()) as ChatCompletion;
    const choice = data.choices?.[0];
    const text = choice?.message?.content?.trim() || choice?.message?.reasoning_content?.trim();
    if (!text) {
      throw new Error("DeepSeek 未返回文本内容");
    }

    const result: DeepSeekTextResult = {
      text,
      ...(choice?.finish_reason ? { finishReason: choice.finish_reason } : {}),
    };
    if (data.usage?.prompt_tokens !== undefined || data.usage?.completion_tokens !== undefined) {
      result.usage = {
        ...(data.usage.prompt_tokens !== undefined ? { inputTokens: data.usage.prompt_tokens } : {}),
        ...(data.usage.completion_tokens !== undefined
          ? { outputTokens: data.usage.completion_tokens }
          : {}),
      };
    }
    return result;
  }
}
