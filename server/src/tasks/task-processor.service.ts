import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiException } from "../common/api-exception";
import { CredentialsService } from "../byok/credentials.service";
import { DeepSeekTextProvider } from "../providers/deepseek-text.provider";
import { UpstreamAuthError } from "../providers/provider-adapter";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { TasksService } from "./tasks.service";
import type { InternalTask } from "./task.types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TaskProcessorService {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly tasks: TasksService,
    private readonly deepseek: DeepSeekTextProvider,
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
    if (task.credentialId) {
      await this.runByokText(task);
      return;
    }

    if (this.deepseek.isModel(task.modelId)) {
      await sleep(150);
      if (!(await this.tasks.isActive(task.taskId))) return;
      await this.tasks.setProgress(task.taskId, 50);
      if (!(await this.tasks.isActive(task.taskId))) return;

      const result = await this.deepseek.generate({
        prompt: task.request.prompt,
        systemPrompt: task.request.params.systemPrompt,
        temperature: task.request.params.temperature,
        maxOutputTokens: task.request.params.maxOutputTokens,
      });
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
      return;
    }

    throw new ApiException(30001, "当前模型未接入供应商", 400);
  }

  private async runByokText(task: InternalTask): Promise<void> {
    const credentialId = task.credentialId;
    if (!credentialId) return;

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
        {
          baseUrl: resolved.provider.baseUrl,
          apiKey: resolved.apiKey,
          authType: resolved.provider.authType,
          timeoutMs: resolved.provider.timeoutMs,
          ...(resolved.provider.extra &&
          typeof resolved.provider.extra === "object" &&
          !Array.isArray(resolved.provider.extra)
            ? { extra: resolved.provider.extra as Record<string, unknown> }
            : {}),
        },
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
    throw new ApiException(
      30001,
      task.credentialId ? "图片 BYOK 暂未接入" : "图片生成暂未接入供应商",
      400,
    );
  }

  private async runVideo(task: InternalTask): Promise<void> {
    throw new ApiException(
      30001,
      task.credentialId ? "视频 BYOK 暂未接入" : "视频生成暂未接入供应商",
      400,
    );
  }
}
