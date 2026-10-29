import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ApiException } from "../common/api-exception";
import { ModelsService } from "../models/models.service";
import type { CreateGenerationDto } from "./dto/create-generation.dto";
import { TaskEvents } from "./task.events";
import { TasksService } from "./tasks.service";

function createService() {
  return new TasksService(new ModelsService(), new TaskEvents());
}

function textDto(overrides: Partial<CreateGenerationDto> = {}): CreateGenerationDto {
  return {
    modelId: "mock-text",
    prompt: "写一句测试文案",
    clientRequestId: "node-1:req-12345678",
    ...overrides,
  } as CreateGenerationDto;
}

describe("TasksService", () => {
  it("creates a text task and returns the same task for a repeated idempotency key", () => {
    const tasks = createService();
    const first = tasks.create("user-1", "text", textDto());
    const second = tasks.create("user-1", "text", textDto());

    expect(first.created).toBe(true);
    expect(first.task.kind).toBe("text");
    expect(first.task.status).toBe("queued");
    expect(first.task.mode).toBe("");
    expect(second.created).toBe(false);
    expect(second.task.taskId).toBe(first.task.taskId);
  });

  it("clamps image count to the model limit", () => {
    const tasks = createService();
    const { task } = tasks.create("user-1", "image", {
      modelId: "mock-image",
      mode: "textToImage",
      prompt: "雨夜霓虹",
      params: { count: 99 },
      clientRequestId: "node-1:req-image-1",
    } as CreateGenerationDto);

    expect(task.status).toBe("queued");
    expect(tasks.getInternal(task.taskId)?.request.params.count).toBe(4);
  });

  it("rejects an invalid video reference combination", () => {
    const tasks = createService();
    let error: unknown;
    try {
      tasks.create("user-1", "video", {
        modelId: "mock-video",
        mode: "firstLastFrame",
        prompt: "推进",
        references: [{ type: "firstFrame", url: "https://example.com/a.png" }],
        clientRequestId: "node-1:req-video-1",
      } as CreateGenerationDto);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(20001);
  });

  it("rejects cancelling a task after it reaches a terminal state", () => {
    const tasks = createService();
    const { task } = tasks.create("user-1", "text", textDto());
    tasks.complete(task.taskId, [
      {
        id: "item_1",
        kind: "text",
        text: "完成",
        modelId: "mock-text",
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(tasks.get("user-1", task.taskId).status).toBe("succeeded");
    let error: unknown;
    try {
      tasks.cancel("user-1", task.taskId);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(20005);
  });

  it("does not expose internal request data in the public task view", () => {
    const tasks = createService();
    const { task } = tasks.create("user-1", "text", textDto());
    const publicTask = tasks.get("user-1", task.taskId) as unknown as Record<string, unknown>;

    expect(publicTask.taskId).toBe(task.taskId);
    expect(publicTask.userId).toBeUndefined();
    expect(publicTask.request).toBeUndefined();
  });
});
