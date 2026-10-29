import { Injectable } from "@nestjs/common";
import {
  UpstreamAuthError,
  type ProviderAdapter,
  type ProviderContext,
  type ProviderModelInfo,
  type ProviderTestResult,
  type TextInput,
  type TextOutput,
} from "../provider-adapter";

type ModelsResponse = {
  data?: { id?: string }[];
};

type ChatCompletion = {
  choices?: {
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const NON_TEXT_MARKERS = [
  "embedding",
  "embed-",
  "whisper",
  "tts",
  "audio",
  "moderation",
  "dall-e",
  "stable-diffusion",
  "flux",
  "video",
  "rerank",
];

function isTextModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return !NON_TEXT_MARKERS.some((marker) => lower.includes(marker));
}

function authHeaders(ctx: ProviderContext): Record<string, string> {
  if (ctx.authType === "x-api-key") {
    return { "x-api-key": ctx.apiKey };
  }
  return { Authorization: `Bearer ${ctx.apiKey}` };
}

@Injectable()
export class OpenAICompatibleAdapter implements ProviderAdapter {
  async listModels(ctx: ProviderContext): Promise<ProviderModelInfo[]> {
    const response = await this.request(ctx, "/models", { method: "GET" });
    const data = (await response.json()) as ModelsResponse;
    const items = Array.isArray(data.data) ? data.data : [];
    const ids = items
      .map((item) => item.id?.trim())
      .filter((id): id is string => Boolean(id));
    return ids
      .filter((id) => isTextModel(id))
      .map((id) => ({
        modelId: id,
        displayName: id,
        kind: "text" as const,
        capabilities: {},
      }));
  }

  async testKey(ctx: ProviderContext): Promise<ProviderTestResult> {
    const response = await this.request(ctx, "/models", { method: "GET" });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new UpstreamAuthError();
      return { ok: false, message: `供应商返回 HTTP ${response.status}` };
    }
    return { ok: true };
  }

  async generateText(ctx: ProviderContext, input: TextInput): Promise<TextOutput> {
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (input.systemPrompt?.trim()) {
      messages.push({ role: "system", content: input.systemPrompt.trim() });
    }
    messages.push({ role: "user", content: input.prompt });

    const body: Record<string, unknown> = {
      model: input.model,
      messages,
      stream: false,
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.maxOutputTokens !== undefined) body.max_tokens = input.maxOutputTokens;

    const response = await this.request(ctx, "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 401 || response.status === 403) {
      throw new UpstreamAuthError();
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`供应商请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`);
    }

    const data = (await response.json()) as ChatCompletion;
    const choice = data.choices?.[0];
    const text = choice?.message?.content?.trim() || choice?.message?.reasoning_content?.trim();
    if (!text) throw new Error("供应商未返回文本内容");

    const output: TextOutput = {
      text,
      ...(choice?.finish_reason ? { finishReason: choice.finish_reason } : {}),
    };
    if (data.usage?.prompt_tokens !== undefined || data.usage?.completion_tokens !== undefined) {
      output.usage = {
        ...(data.usage.prompt_tokens !== undefined
          ? { inputTokens: data.usage.prompt_tokens }
          : {}),
        ...(data.usage.completion_tokens !== undefined
          ? { outputTokens: data.usage.completion_tokens }
          : {}),
      };
    }
    return output;
  }

  private async request(
    ctx: ProviderContext,
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
  ): Promise<Response> {
    try {
      return await fetch(`${ctx.baseUrl.replace(/\/+$/, "")}${path}`, {
        method: init.method,
        headers: {
          Accept: "application/json",
          ...authHeaders(ctx),
          ...init.headers,
        },
        ...(init.body ? { body: init.body } : {}),
        signal: AbortSignal.timeout(ctx.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`供应商请求超时（${Math.round(ctx.timeoutMs / 1000)}s）`);
      }
      throw error;
    }
  }
}
