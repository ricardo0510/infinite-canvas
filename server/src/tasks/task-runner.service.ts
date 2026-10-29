import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TaskEvents } from "./task.events";
import { TasksService } from "./tasks.service";
import type { ImageResultItem, InternalTask, VideoResultItem } from "./task.types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockSvg(prompt: string, index: number): string {
  const label = (prompt.trim() || "模拟图片").slice(0, 42).replace(/[<>&]/g, "");
  const hue = (index * 67 + 210) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 28%)"/><stop offset="1" stop-color="hsl(${(hue + 90) % 360} 70% 52%)"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><circle cx="760" cy="250" r="220" fill="rgba(255,255,255,.14)"/><circle cx="230" cy="820" r="300" fill="rgba(0,0,0,.18)"/><text x="64" y="520" fill="white" font-family="Inter, sans-serif" font-size="52" font-weight="600">${label}</text><text x="64" y="590" fill="rgba(255,255,255,.72)" font-family="Inter, sans-serif" font-size="30">模拟图片 ${index + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

@Injectable()
export class TaskRunner implements OnModuleInit {
  constructor(
    private readonly tasks: TasksService,
    private readonly events: TaskEvents,
  ) {}

  private readonly activeRuns = new Set<string>();

  onModuleInit(): void {
    this.events.created$.subscribe((task) => {
      void this.run(task.taskId);
    });
    void this.resume();
  }

  private async resume(): Promise<void> {
    const tasks = await this.tasks.listActive();
    for (const task of tasks) void this.run(task.taskId);
  }

  private async run(taskId: string): Promise<void> {
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
        30001,
        error instanceof Error ? error.message : "上游模型失败",
      );
    } finally {
      this.activeRuns.delete(taskId);
    }
  }

  private async runText(task: InternalTask): Promise<void> {
    await sleep(600);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 60);
    await sleep(500);
    if (!(await this.tasks.isActive(task.taskId))) return;

    const prompt = task.request.prompt;
    const text = prompt.trim()
      ? `这是模拟生成的文本结果。\n\n提示词：${prompt.trim()}\n\n接入真实接口后，这里会返回模型生成的完整内容。`
      : "这是模拟生成的文本结果。";
    await this.tasks.complete(task.taskId, [
      {
        id: `item_${randomUUID()}`,
        kind: "text",
        text,
        modelId: task.modelId,
        createdAt: new Date().toISOString(),
        usage: {
          inputTokens: Math.ceil(prompt.length / 4),
          outputTokens: Math.ceil(text.length / 4),
        },
        finishReason: "stop",
      },
    ]);
  }

  private async runImage(task: InternalTask): Promise<void> {
    await sleep(450);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 55);
    await sleep(650);
    if (!(await this.tasks.isActive(task.taskId))) return;

    const count = Math.min(4, Math.max(1, task.request.params.count ?? 1));
    const items: ImageResultItem[] = Array.from({ length: count }, (_, index) => ({
      id: `item_${randomUUID()}`,
      kind: "image",
      url: mockSvg(task.request.prompt, index),
      width: 1024,
      height: 1024,
      modelId: task.modelId,
      createdAt: new Date().toISOString(),
    }));
    await this.tasks.complete(task.taskId, items);
  }

  private async runVideo(task: InternalTask): Promise<void> {
    await sleep(600);
    if (!(await this.tasks.isActive(task.taskId))) return;
    await this.tasks.setProgress(task.taskId, 50);
    await sleep(800);
    if (!(await this.tasks.isActive(task.taskId))) return;

    const item: VideoResultItem = {
      id: `item_${randomUUID()}`,
      kind: "video",
      url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      thumbnailUrl: mockSvg(task.request.prompt, 0),
      duration: task.request.params.duration ?? 5,
      width: 1280,
      height: 720,
      modelId: task.modelId,
      createdAt: new Date().toISOString(),
    };
    await this.tasks.complete(task.taskId, [item]);
  }
}
