import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiException } from "../common/api-exception";
import type { AiModel } from "../models/model.types";
import { ModelsService } from "../models/models.service";
import type { CreateGenerationDto } from "./dto/create-generation.dto";
import { TaskEvents } from "./task.events";
import { TASK_REPOSITORY, type TaskRepository } from "./task.repository";
import {
  toPublicTask,
  type ApiTask,
  type CreatedTask,
  type GenerationParams,
  type InternalTask,
  type ReferenceInput,
  type ResultItem,
  type TaskKind,
  type TaskStatus,
} from "./task.types";

const TERMINAL: TaskStatus[] = ["succeeded", "failed", "canceled"];
const RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function now(): string {
  return new Date().toISOString();
}

function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.includes(status);
}

@Injectable()
export class TasksService {
  constructor(
    private readonly models: ModelsService,
    private readonly events: TaskEvents,
    @Inject(TASK_REPOSITORY) private readonly repo: TaskRepository,
  ) {}

  async create(userId: string, kind: TaskKind, dto: CreateGenerationDto): Promise<CreatedTask> {
    const existing = await this.repo.findByClientRequest(userId, kind, dto.clientRequestId);
    if (existing) return { task: existing, created: false };

    const model = this.models.require(dto.modelId, kind);
    if (!dto.prompt.trim()) {
      throw new ApiException(20001, "prompt 不能为空", 422);
    }
    if (dto.prompt.length > model.limits.maxPromptLength) {
      throw new ApiException(
        20001,
        `提示词不能超过 ${model.limits.maxPromptLength} 个字符`,
        422,
      );
    }

    const references = this.validateReferences(kind, model, dto);
    const mode = this.resolveMode(kind, model, dto.mode, references);
    const params = this.validateParams(kind, model, dto);

    const createdAt = now();
    const task: InternalTask = {
      taskId: `task_${randomUUID()}`,
      kind,
      status: "queued",
      progress: 0,
      modelId: model.id,
      mode,
      result: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(Date.now() + RESULT_TTL_MS).toISOString(),
      userId,
      clientRequestId: dto.clientRequestId,
      request: { prompt: dto.prompt, params, references },
    };

    try {
      await this.repo.create(task);
    } catch (error) {
      // 并发同 key 时唯一索引会冲突，返回已创建的任务。
      const raced = await this.repo.findByClientRequest(userId, kind, dto.clientRequestId);
      if (raced) return { task: raced, created: false };
      throw error;
    }

    this.events.emitCreated(task);
    return { task, created: true };
  }

  async find(userId: string, taskId: string): Promise<ApiTask | undefined> {
    const task = await this.repo.findById(taskId);
    if (!task || task.userId !== userId) return undefined;
    return toPublicTask(task);
  }

  async get(userId: string, taskId: string): Promise<ApiTask> {
    const task = await this.find(userId, taskId);
    if (!task) throw new ApiException(10004, "任务不存在", 404);
    return task;
  }

  async getInternal(taskId: string): Promise<InternalTask | undefined> {
    return this.repo.findById(taskId);
  }

  async listActive(): Promise<InternalTask[]> {
    return this.repo.listActive();
  }

  async cancel(userId: string, taskId: string): Promise<ApiTask> {
    const task = await this.repo.findById(taskId);
    if (!task || task.userId !== userId) {
      throw new ApiException(10004, "任务不存在", 404);
    }
    if (isTerminal(task.status)) {
      throw new ApiException(20005, "任务已结束，不能重复操作", 409);
    }
    task.status = "canceled";
    task.progress = 0;
    task.result = null;
    task.error = null;
    task.updatedAt = now();
    await this.repo.update(task);
    this.events.emitUpdated(task);
    return toPublicTask(task);
  }

  async isActive(taskId: string): Promise<boolean> {
    const task = await this.repo.findById(taskId);
    return Boolean(task && (task.status === "queued" || task.status === "running"));
  }

  async setProgress(taskId: string, progress: number): Promise<void> {
    const task = await this.repo.findById(taskId);
    if (!task || isTerminal(task.status)) return;
    task.status = "running";
    task.progress = Math.max(0, Math.min(99, Math.round(progress)));
    task.updatedAt = now();
    await this.repo.update(task);
    this.events.emitUpdated(task);
  }

  async complete(taskId: string, items: ResultItem[]): Promise<void> {
    const task = await this.repo.findById(taskId);
    if (!task || isTerminal(task.status)) return;
    task.status = "succeeded";
    task.progress = 100;
    task.result = { kind: task.kind, items };
    task.error = null;
    task.updatedAt = now();
    await this.repo.update(task);
    this.events.emitUpdated(task);
  }

  async fail(taskId: string, code: number, message: string): Promise<void> {
    const task = await this.repo.findById(taskId);
    if (!task || isTerminal(task.status)) return;
    task.status = "failed";
    task.progress = 0;
    task.result = null;
    task.error = { code, message };
    task.updatedAt = now();
    await this.repo.update(task);
    this.events.emitUpdated(task);
  }

  private validateReferences(
    kind: TaskKind,
    model: AiModel,
    dto: CreateGenerationDto,
  ): ReferenceInput[] {
    const references = (dto.references ?? []).map((reference) => ({
      type: reference.type,
      url: reference.url,
      ...(reference.assetId ? { assetId: reference.assetId } : {}),
    }));

    if (kind === "text" && references.length > 0) {
      throw new ApiException(20001, "文本生成不支持 references", 422);
    }
    if (kind === "image") {
      if (references.length > model.limits.maxImages) {
        throw new ApiException(20001, "参考图数量超出模型限制", 422);
      }
      const invalid = references.find(
        (reference) => reference.type !== "reference" && reference.type !== "referenceImage",
      );
      if (invalid) {
        throw new ApiException(20001, "图片生成只允许 reference 类型引用", 422);
      }
    }
    if (kind === "video") {
      const images = references.filter((reference) => reference.type === "referenceImage");
      const videos = references.filter((reference) => reference.type === "referenceVideo");
      if (images.length > model.limits.maxImages) {
        throw new ApiException(20001, "参考图数量超出模型限制", 422);
      }
      if (videos.length > model.limits.maxVideos) {
        throw new ApiException(20001, "参考视频数量超出模型限制", 422);
      }
    }
    return references;
  }

  private resolveMode(
    kind: TaskKind,
    model: AiModel,
    requested: string | undefined,
    references: ReferenceInput[],
  ): string {
    if (kind === "text") return "";

    let mode = requested;
    if (!mode) {
      if (kind === "image") {
        mode = references.length > 0 ? "imageToImage" : "textToImage";
      } else {
        const hasVideo = references.some((reference) => reference.type === "referenceVideo");
        const first = references.some((reference) => reference.type === "firstFrame");
        const last = references.some((reference) => reference.type === "lastFrame");
        const images = references.some((reference) => reference.type === "referenceImage");
        mode = hasVideo
          ? "referenceVideo"
          : first && last
            ? "firstLastFrame"
            : images
              ? "imageToVideo"
              : "textToVideo";
      }
    }

    if (!model.modes.includes(mode)) {
      throw new ApiException(20001, `模型不支持 mode=${mode}`, 422);
    }

    if (kind === "image") {
      if (mode === "imageToImage" && references.length === 0) {
        throw new ApiException(20001, "imageToImage 至少需要 1 张参考图", 422);
      }
      if (mode === "textToImage" && references.length > 0) {
        throw new ApiException(20001, "textToImage 不允许参考图", 422);
      }
    }

    if (kind === "video") {
      const first = references.filter((reference) => reference.type === "firstFrame");
      const last = references.filter((reference) => reference.type === "lastFrame");
      const images = references.filter((reference) => reference.type === "referenceImage");
      const videos = references.filter((reference) => reference.type === "referenceVideo");

      if (mode === "textToVideo" && references.length > 0) {
        throw new ApiException(20001, "textToVideo 不允许图片或视频引用", 422);
      }
      if (mode === "imageToVideo") {
        if (images.length === 0) {
          throw new ApiException(20001, "imageToVideo 至少需要 1 张参考图", 422);
        }
        if (first.length > 0 || last.length > 0 || videos.length > 0) {
          throw new ApiException(20001, "imageToVideo 只允许 referenceImage", 422);
        }
      }
      if (mode === "firstLastFrame") {
        if (first.length !== 1 || last.length !== 1) {
          throw new ApiException(20001, "firstLastFrame 需要 1 张首帧和 1 张尾帧", 422);
        }
        if (images.length > 0 || videos.length > 0) {
          throw new ApiException(20001, "firstLastFrame 只允许首尾帧", 422);
        }
      }
      if (mode === "referenceVideo" && videos.length === 0) {
        throw new ApiException(20001, "referenceVideo 至少需要 1 个参考视频", 422);
      }
    }

    return mode;
  }

  private validateParams(
    kind: TaskKind,
    model: AiModel,
    dto: CreateGenerationDto,
  ): GenerationParams {
    const input = dto.params ?? {};
    const params: GenerationParams = {
      ...(dto.negativePrompt ? { negativePrompt: dto.negativePrompt } : {}),
      ...(input.watermark !== undefined ? { watermark: input.watermark } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.extra ? { extra: input.extra } : {}),
    };

    if (kind === "text") {
      if (dto.systemPrompt) params.systemPrompt = dto.systemPrompt;
      if (input.temperature !== undefined) params.temperature = input.temperature;
      if (input.maxOutputTokens !== undefined) params.maxOutputTokens = input.maxOutputTokens;
      return params;
    }

    if (kind === "image") {
      const output = model.output.image;
      if (!output) throw new ApiException(20001, "模型不支持图片输出", 422);
      if (input.aspectRatio && !output.aspectRatios.includes(input.aspectRatio)) {
        throw new ApiException(20001, "aspectRatio 不在模型能力范围内", 422);
      }
      if (input.resolution && !output.resolutions.includes(input.resolution)) {
        throw new ApiException(20001, "resolution 不在模型能力范围内", 422);
      }
      if (
        input.qualityTier &&
        !model.params?.qualityTiers?.some((tier) => tier.key === input.qualityTier)
      ) {
        throw new ApiException(20001, "qualityTier 不可用", 422);
      }
      if (input.background && !model.params?.backgrounds?.includes(input.background)) {
        throw new ApiException(20001, "background 不可用", 422);
      }
      this.validateExtra(model, input.extra);
      params.aspectRatio = input.aspectRatio ?? output.aspectRatios[0];
      params.resolution = input.resolution ?? output.resolutions[0];
      params.count = Math.min(output.maxCount, Math.max(1, input.count ?? 1));
      if (input.qualityTier) params.qualityTier = input.qualityTier;
      if (input.background) params.background = input.background;
      if (params.watermark === undefined) params.watermark = true;
      return params;
    }

    const output = model.output.video;
    if (!output) throw new ApiException(20001, "模型不支持视频输出", 422);
    if (input.aspectRatio && !output.aspectRatios.includes(input.aspectRatio)) {
      throw new ApiException(20001, "aspectRatio 不在模型能力范围内", 422);
    }
    if (input.resolution && !output.resolutions.includes(input.resolution)) {
      throw new ApiException(20001, "resolution 不在模型能力范围内", 422);
    }
    const duration = input.duration ?? output.minDuration;
    if (duration < output.minDuration || duration > output.maxDuration) {
      throw new ApiException(
        20001,
        `duration 必须在 ${output.minDuration}–${output.maxDuration} 秒之间`,
        422,
      );
    }
    if (input.generateAudio === true && !output.supportsAudio) {
      throw new ApiException(20001, "当前模型不支持音频", 422);
    }
    if (
      input.qualityTier &&
      !model.params?.qualityTiers?.some((tier) => tier.key === input.qualityTier)
    ) {
      throw new ApiException(20001, "qualityTier 不可用", 422);
    }
    this.validateExtra(model, input.extra);
    params.aspectRatio = input.aspectRatio ?? output.aspectRatios[0];
    params.resolution = input.resolution ?? output.resolutions[0];
    params.duration = duration;
    params.generateAudio = input.generateAudio === true;
    params.watermark = params.watermark ?? true;
    if (input.qualityTier) params.qualityTier = input.qualityTier;
    return params;
  }

  private validateExtra(
    model: AiModel,
    extra: Record<string, string | number | boolean> | undefined,
  ): void {
    if (!extra) return;
    const allowed = new Set((model.params?.extra ?? []).map((item) => item.key));
    for (const key of Object.keys(extra)) {
      if (!allowed.has(key)) {
        throw new ApiException(20001, `未知参数 params.extra.${key}`, 422);
      }
    }
  }
}
