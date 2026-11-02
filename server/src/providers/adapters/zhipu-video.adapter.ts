import { Injectable } from "@nestjs/common";
import {
  UpstreamAuthError,
  type ProviderAdapter,
  type ProviderContext,
  type ProviderModelInfo,
  type ProviderTestResult,
  type VideoInput,
  type VideoPollResult,
} from "../provider-adapter";

type ZhipuVideoStatusResponse = {
  task_status?: string;
  video_result?: { url?: string; cover_image_url?: string }[];
  error?: { code?: string; message?: string };
};

type ZhipuVideoSubmitResponse = {
  id?: string;
  error?: { code?: string; message?: string };
};

const MODELS: { modelId: string; displayName: string }[] = [
  { modelId: "cogvideox-flash", displayName: "CogVideoX Flash" },
  { modelId: "cogvideox-2", displayName: "CogVideoX 2" },
  { modelId: "cogvideox-3", displayName: "CogVideoX 3" },
];

export function zhipuVideoSize(
  model: string,
  aspectRatio = "16:9",
  resolution = "720p",
): string {
  const isV3 = model === "cogvideox-3";
  const is720 = resolution.toLowerCase() === "720p";
  const is4k = resolution.toLowerCase() === "4k";
  if (isV3) {
    if (aspectRatio === "9:16") return is720 ? "720x1280" : "1080x1920";
    if (aspectRatio === "1:1") return "1024x1024";
    if (is4k) return "3840x2160";
    return is720 ? "1280x720" : "1920x1080";
  }
  if (aspectRatio === "9:16") return "1080x1920";
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "4:3") return "1280x960";
  if (aspectRatio === "3:4") return "960x1280";
  return "1920x1080";
}

@Injectable()
export class ZhipuVideoAdapter implements ProviderAdapter {
  async listModels(): Promise<ProviderModelInfo[]> {
    return MODELS.map((model) => ({
      modelId: model.modelId,
      displayName: model.displayName,
      kind: "video" as const,
      capabilities: {},
    }));
  }

  async testKey(ctx: ProviderContext): Promise<ProviderTestResult> {
    const response = await this.request(ctx, "/async-result/connectivity-check", "GET");
    // 400/404 表示鉴权已通过，只是这个探测任务不存在；401/403 才是 Key 有问题。
    if (response.status === 401 || response.status === 403) {
      throw new UpstreamAuthError();
    }
    if (response.status >= 500) {
      throw new Error(`智谱服务异常（HTTP ${response.status}）`);
    }
    return { ok: true };
  }

  async submitVideo(
    ctx: ProviderContext,
    input: VideoInput,
  ): Promise<{ providerTaskId: string; width?: number; height?: number }> {
    const size = zhipuVideoSize(input.model, input.aspectRatio, input.resolution);
    const [width, height] = size.split("x").map(Number);
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      quality: "speed",
      fps: 30,
      size,
    };
    if (input.model === "cogvideox-3") {
      body.duration = input.duration ?? 5;
      body.with_audio = input.generateAudio === true;
    }
    if (input.firstFrameUrl && input.lastFrameUrl) {
      body.image_url = [input.firstFrameUrl, input.lastFrameUrl];
    } else if (input.firstFrameUrl) {
      body.image_url = input.firstFrameUrl;
    } else if (input.referenceUrls?.[0]) {
      body.image_url = input.referenceUrls[0];
    }

    const response = await this.request(ctx, "/videos/generations", "POST", body);
    await this.assertOk(response);
    const data = (await response.json()) as ZhipuVideoSubmitResponse;
    if (!data.id) {
      throw new Error(data.error?.message || "智谱未返回视频任务 ID");
    }
    return { providerTaskId: data.id, width, height };
  }

  async pollVideo(ctx: ProviderContext, providerTaskId: string): Promise<VideoPollResult> {
    const response = await this.request(
      ctx,
      `/async-result/${encodeURIComponent(providerTaskId)}`,
      "GET",
    );
    await this.assertOk(response);
    const data = (await response.json()) as ZhipuVideoStatusResponse;
    const status = (data.task_status ?? "").toUpperCase();
    if (status === "SUCCESS") {
      const video = data.video_result?.[0];
      if (!video?.url) throw new Error("视频生成成功但未返回地址");
      return {
        status: "succeeded",
        video: {
          url: video.url,
          ...(video.cover_image_url ? { thumbnailUrl: video.cover_image_url } : {}),
        },
      };
    }
    if (status === "FAIL" || status === "FAILED") {
      return {
        status: "failed",
        message: data.error?.message || "视频生成失败",
      };
    }
    return { status: status === "PROCESSING" ? "running" : "queued" };
  }

  private async request(
    ctx: ProviderContext,
    path: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ): Promise<Response> {
    try {
      return await fetch(`${ctx.baseUrl.replace(/\/+$/, "")}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(ctx.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`智谱请求超时（${Math.round(ctx.timeoutMs / 1000)}s）`);
      }
      throw error;
    }
  }

  private async assertOk(response: Response): Promise<void> {
    if (response.status === 401) throw new UpstreamAuthError();
    if (response.status === 403) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      if (/invalid|unauthorized|forbidden|api key/i.test(detail)) {
        throw new UpstreamAuthError();
      }
      throw new Error(`智谱请求失败（HTTP 403）${detail ? `：${detail}` : ""}`);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`智谱请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`);
    }
  }
}
