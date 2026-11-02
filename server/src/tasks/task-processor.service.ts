import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiException } from "../common/api-exception";
import { CredentialsService, type ResolvedCredential } from "../byok/credentials.service";
import {
  UpstreamAuthError,
  type ImageOutput,
  type ProviderContext,
  type VideoPollResult,
} from "../providers/provider-adapter";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { TasksService } from "./tasks.service";
import type { ImageResultItem, InternalTask, VideoResultItem } from "./task.types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TaskProcessorService {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly tasks: TasksService,
    private readonly credentials: CredentialsService,
    private readonly registry: ProviderRegistry,
  ) {}

  async execute(taskId: string): Promise<void> {
    if (this.activeRuns.has(taskId)) return;
    this.activeRuns.add(taskId);
    const task = await this.tasks.getInternal(taskId);
    if (!task) {
      this.activeRuns.delete(taskId);
      return;
    }

    try {
      await sleep(80);
      if (!(await this.tasks.isActive(taskId))) return;
      await this.tasks.setProgress(taskId, 15);

      if (task.kind === "text") {
        await this.runText(task);
        return;
      }
      if (task.kind === "image") {
        await this.runImage(task);
        return;
      }
      await this.runVideo(task);
    } catch (error) {
      await this.tasks.fail(
        taskId,
        error instanceof ApiException ? error.code : 30001,
        error instanceof Error ? error.message : "上游模型失败",
      );
    } finally {
      this.activeRuns.delete(taskId);
    }
  }

  private async runText(task: InternalTask): Promise<void> {
    if (!task.credentialId) {
      throw new ApiException(20003, "请先在 AI 设置中绑定供应商 API Key", 400);
    }
    await this.runByokText(task);
  }

  private async runByokText(task: InternalTask): Promise<void> {
    const credentialId = task.credentialId;
    if (!credentialId) {
      throw new ApiException(20003, "请先在 AI 设置中绑定供应商 API Key", 400);
    }

    await sleep(120);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 40);

    let resolved;
    try {
      resolved = await this.credentials.resolve(credentialId);
    } catch (error) {
      if (error instanceof ApiException) {
        await this.tasks.fail(task.taskId, error.code, error.message);
        return;
      }
      throw error;
    }

    const adapter = this.registry.get(resolved.provider.adapter);
    if (!adapter.generateText) {
      throw new ApiException(30001, "当前供应商暂不支持文本生成", 400);
    }

    if (!(await this.tasks.isActive(task.taskId))) return;

    let result;
    try {
      result = await adapter.generateText(
        this.context(resolved),
        {
          model: task.providerModel ?? task.modelId,
          prompt: task.request.prompt,
          ...(task.request.params.systemPrompt
            ? { systemPrompt: task.request.params.systemPrompt }
            : {}),
          ...(task.request.params.temperature !== undefined
            ? { temperature: task.request.params.temperature }
            : {}),
          ...(task.request.params.maxOutputTokens !== undefined
            ? { maxOutputTokens: task.request.params.maxOutputTokens }
            : {}),
        },
      );
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.credentials.markInvalid(credentialId);
        await this.tasks.fail(task.taskId, 30001, "API Key 已失效，请重新绑定");
        return;
      }
      throw error;
    }

    await this.credentials.touch(credentialId);
    if (!(await this.tasks.isActive(task.taskId))) return;

    await this.tasks.complete(task.taskId, [
      {
        id: `item_${randomUUID()}`,
        kind: "text",
        text: result.text,
        modelId: task.modelId,
        createdAt: new Date().toISOString(),
        ...(result.usage ? { usage: result.usage } : {}),
        ...(result.finishReason ? { finishReason: result.finishReason } : {}),
      },
    ]);
  }

  private async runImage(task: InternalTask): Promise<void> {
    if (!task.credentialId) {
      throw new ApiException(20003, "请先在 AI 设置中绑定供应商 API Key", 400);
    }

    await sleep(120);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 35);

    let resolved;
    try {
      resolved = await this.credentials.resolve(task.credentialId);
    } catch (error) {
      if (error instanceof ApiException) {
        await this.tasks.fail(task.taskId, error.code, error.message);
        return;
      }
      throw error;
    }

    const adapter = this.registry.get(resolved.provider.adapter);
    if (!adapter.generateImage) {
      throw new ApiException(30001, "当前供应商暂不支持图片生成", 400);
    }

    const params = task.request.params;
    let images: ImageOutput[];
    try {
      images = await adapter.generateImage(
        this.context(resolved),
        {
          model: task.providerModel ?? task.modelId,
          prompt: task.request.prompt,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          count: Math.max(1, params.count ?? 1),
          ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
          ...(params.watermark !== undefined ? { watermark: params.watermark } : {}),
          ...(params.seed !== undefined ? { seed: params.seed } : {}),
          referenceUrls: task.request.references.map((reference) => reference.url),
        },
      );
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.credentials.markInvalid(task.credentialId);
        await this.tasks.fail(task.taskId, 30001, "API Key 已失效，请重新绑定");
        return;
      }
      throw error;
    }

    await this.credentials.touch(task.credentialId);
    if (!(await this.tasks.isActive(task.taskId))) return;

    const items: ImageResultItem[] = images.map((image) => ({
      id: `item_${randomUUID()}`,
      kind: "image",
      url: image.url,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
      modelId: task.modelId,
      createdAt: new Date().toISOString(),
    }));
    await this.tasks.complete(task.taskId, items);
  }

  private async runVideo(task: InternalTask): Promise<void> {
    if (!task.credentialId) {
      throw new ApiException(20003, "请先在 AI 设置中绑定供应商 API Key", 400);
    }

    await sleep(120);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 20);

    let resolved;
    try {
      resolved = await this.credentials.resolve(task.credentialId);
    } catch (error) {
      if (error instanceof ApiException) {
        await this.tasks.fail(task.taskId, error.code, error.message);
        return;
      }
      throw error;
    }

    const adapter = this.registry.get(resolved.provider.adapter);
    if (!adapter.submitVideo || !adapter.pollVideo) {
      throw new ApiException(30001, "当前供应商暂不支持视频生成", 400);
    }

    const params = task.request.params;
    const references = task.request.references;
    const firstFrame =
      task.mode === "imageToVideo"
        ? references.find((reference) => reference.type === "referenceImage")
        : task.mode === "firstLastFrame"
          ? (references.find((reference) => reference.type === "firstFrame") ??
            references.find((reference) => reference.type === "referenceImage"))
          : undefined;
    const lastFrame =
      task.mode === "firstLastFrame"
        ? references.find((reference) => reference.type === "lastFrame")
        : undefined;
    const providerContext = this.context(resolved);

    let providerTaskId = "";
    let videoWidth: number | undefined;
    let videoHeight: number | undefined;
    try {
      const submitted = await adapter.submitVideo(providerContext, {
        model: task.providerModel ?? task.modelId,
        prompt: task.request.prompt,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        duration: params.duration,
        ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
        ...(params.generateAudio !== undefined
          ? { generateAudio: params.generateAudio }
          : {}),
        ...(params.seed !== undefined ? { seed: params.seed } : {}),
        ...(firstFrame ? { firstFrameUrl: firstFrame.url } : {}),
        ...(lastFrame ? { lastFrameUrl: lastFrame.url } : {}),
        referenceUrls: references
          .filter(
            (reference) =>
              reference.type === "referenceImage" || reference.type === "reference",
          )
          .map((reference) => reference.url),
      });
      providerTaskId = submitted.providerTaskId;
      videoWidth = submitted.width;
      videoHeight = submitted.height;
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.credentials.markInvalid(task.credentialId);
        await this.tasks.fail(task.taskId, 30001, "API Key 已失效，请重新绑定");
        return;
      }
      throw error;
    }

    const startedAt = Date.now();
    const deadline = startedAt + 15 * 60 * 1000;
    let result: VideoPollResult | undefined;
    while (Date.now() < deadline) {
      await sleep(4000);
      if (!(await this.tasks.isActive(task.taskId))) return;
      try {
        result = await adapter.pollVideo(providerContext, providerTaskId);
      } catch (error) {
        if (error instanceof UpstreamAuthError) {
          await this.credentials.markInvalid(task.credentialId);
          await this.tasks.fail(task.taskId, 30001, "API Key 已失效，请重新绑定");
          return;
        }
        throw error;
      }
      if (result.status === "succeeded") break;
      if (result.status === "failed") {
        throw new ApiException(30001, result.message ?? "视频生成失败", 400);
      }
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      await this.tasks.setProgress(task.taskId, Math.min(90, 25 + elapsed));
    }

    if (!result || result.status !== "succeeded" || !result.video) {
      throw new ApiException(30001, "视频生成超时", 400);
    }

    await this.credentials.touch(task.credentialId);
    if (!(await this.tasks.isActive(task.taskId))) return;

    const video = result.video;
    const width = video.width ?? videoWidth;
    const height = video.height ?? videoHeight;
    const item: VideoResultItem = {
      id: `item_${randomUUID()}`,
      kind: "video",
      url: video.url,
      ...(video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {}),
      duration: params.duration ?? video.duration ?? 5,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      modelId: task.modelId,
      createdAt: new Date().toISOString(),
    };
    await this.tasks.complete(task.taskId, [item]);
  }

  private context(resolved: ResolvedCredential): ProviderContext {
    const { provider, apiKey } = resolved;
    return {
      baseUrl: provider.baseUrl,
      apiKey,
      authType: provider.authType,
      timeoutMs: provider.timeoutMs,
      ...(provider.extra && typeof provider.extra === "object" && !Array.isArray(provider.extra)
        ? { extra: provider.extra as Record<string, unknown> }
        : {}),
    };
  }
}
