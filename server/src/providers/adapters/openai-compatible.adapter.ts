import { Injectable } from "@nestjs/common";
import {
  UpstreamAuthError,
  type ImageInput,
  type ImageOutput,
  type ProviderAdapter,
  type ProviderContext,
  type ProviderModelInfo,
  type ProviderTestResult,
  type TextInput,
  type TextOutput,
  type VideoInput,
  type VideoPollResult,
} from "../provider-adapter";
import { inferModelKind, isSupportedUpstreamModel } from "../model-kind";

type ModelsResponse = {
  data?: { id?: string }[];
};

type ImageResponse = {
  images?: { url?: string }[];
  data?: { url?: string; b64_json?: string }[];
};

type VideoSubmitResponse = {
  requestId?: string;
};

type VideoStatusResponse = {
  status?: string;
  reason?: string;
  results?: { videos?: { url?: string }[] };
};

export function resolveVideoSize(aspectRatio = "16:9"): { width: number; height: number } {
  if (aspectRatio === "9:16") return { width: 720, height: 1280 };
  if (aspectRatio === "1:1") return { width: 960, height: 960 };
  return { width: 1280, height: 720 };
}

export function resolveImageSize(
  aspectRatio = "1:1",
  resolution = "1k",
): { width: number; height: number } {
  const longSides: Record<string, number> = {
    auto: 1024,
    "1k": 1024,
    "1.5k": 1536,
    "2k": 2048,
    "3k": 3072,
    "4k": 4096,
  };
  const longSide = longSides[resolution.toLowerCase()] ?? 1024;
  const [ratioWidth, ratioHeight] = aspectRatio.split(":").map(Number);
  if (
    !Number.isFinite(ratioWidth) ||
    !Number.isFinite(ratioHeight) ||
    ratioWidth <= 0 ||
    ratioHeight <= 0
  ) {
    return { width: longSide, height: longSide };
  }
  const rawWidth = ratioWidth >= ratioHeight ? longSide : (longSide * ratioWidth) / ratioHeight;
  const rawHeight = ratioWidth >= ratioHeight ? (longSide * ratioHeight) / ratioWidth : longSide;
  const round = (value: number) => Math.max(256, Math.round(value / 16) * 16);
  return { width: round(rawWidth), height: round(rawHeight) };
}

type ChatCompletion = {
  choices?: {
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function authHeaders(ctx: ProviderContext): Record<string, string> {
  if (ctx.authType === "x-api-key") {
    return { "x-api-key": ctx.apiKey };
  }
  return { Authorization: `Bearer ${ctx.apiKey}` };
}

async function assertOk(response: Response): Promise<void> {
  if (response.status === 401) throw new UpstreamAuthError();
  if (response.status === 403) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (/invalid token|invalid[_\s-]?api[_\s-]?key|unauthorized|forbidden|api key/i.test(detail)) {
      throw new UpstreamAuthError();
    }
    throw new Error(`供应商请求失败（HTTP 403）${detail ? `：${detail}` : ""}`);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`供应商请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`);
  }
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
      .filter((id) => isSupportedUpstreamModel(id))
      .map((id) => ({
        modelId: id,
        displayName: id,
        kind: inferModelKind(id),
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

  async generateImage(ctx: ProviderContext, input: ImageInput): Promise<ImageOutput[]> {
    const size = resolveImageSize(input.aspectRatio, input.resolution);
    const sizeField =
      typeof ctx.extra?.imageSizeField === "string" ? ctx.extra.imageSizeField : "size";
    const resultField = ctx.extra?.imageResponse === "images" ? "images" : "data";
    const referenceUrls = input.referenceUrls ?? [];
    const count = Math.min(4, Math.max(1, input.count));
    const images: ImageOutput[] = [];

    for (let index = 0; index < count; index += 1) {
      const body: Record<string, unknown> = {
        model: input.model,
        prompt: input.prompt,
        [sizeField]: `${size.width}x${size.height}`,
      };
      if (input.negativePrompt) body.negative_prompt = input.negativePrompt;
      if (input.seed !== undefined) body.seed = input.seed + index;
      if (referenceUrls[0]) body.image = referenceUrls[0];

      const response = await this.request(ctx, "/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(input.watermark === false ? { "X-Enable-Watermark": "0" } : {}),
        },
        body: JSON.stringify(body),
      });

      await assertOk(response);

      const data = (await response.json()) as ImageResponse;
      const items: { url?: string; b64_json?: string }[] =
        resultField === "images" ? (data.images ?? []) : (data.data ?? []);
      for (const item of items) {
        const url =
          item.url ??
          (item.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined);
        if (url) images.push({ url, width: size.width, height: size.height });
      }
    }

    if (images.length === 0) throw new Error("供应商未返回图片");
    return images;
  }

  async submitVideo(
    ctx: ProviderContext,
    input: VideoInput,
  ): Promise<{ providerTaskId: string; width?: number; height?: number }> {
    const size = resolveVideoSize(input.aspectRatio);
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      image_size: `${size.width}x${size.height}`,
    };
    if (input.negativePrompt) body.negative_prompt = input.negativePrompt;
    if (input.seed !== undefined) body.seed = input.seed;
    const image = input.firstFrameUrl ?? input.referenceUrls?.[0];
    if (image) body.image = image;

    const response = await this.request(ctx, "/video/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await assertOk(response);

    const data = (await response.json()) as VideoSubmitResponse;
    if (!data.requestId) throw new Error("供应商未返回视频任务 ID");
    return { providerTaskId: data.requestId, width: size.width, height: size.height };
  }

  async pollVideo(ctx: ProviderContext, providerTaskId: string): Promise<VideoPollResult> {
    const response = await this.request(ctx, "/video/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: providerTaskId }),
    });
    await assertOk(response);

    const data = (await response.json()) as VideoStatusResponse;
    const status = (data.status ?? "").toLowerCase();
    if (status === "succeed" || status === "succeeded") {
      const url = data.results?.videos?.[0]?.url;
      if (!url) throw new Error("视频生成成功但未返回地址");
      return { status: "succeeded", video: { url } };
    }
    if (status === "failed") {
      return { status: "failed", message: data.reason || "视频生成失败" };
    }
    if (status === "inqueue" || status === "queued") return { status: "queued" };
    return { status: "running" };
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

    await assertOk(response);

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
