import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ApiException } from "../common/api-exception";
import type { AiModel } from "../models/model.types";
import type { ModelsService } from "../models/models.service";
import type { ProviderCatalogService } from "../byok/provider-catalog.service";
import type { CreateGenerationDto } from "./dto/create-generation.dto";
import { InMemoryTaskRepository } from "./task.repository";
import { TaskEvents } from "./task.events";
import { TasksService } from "./tasks.service";

const TEST_MODELS: AiModel[] = [
  {
    id: "test-text",
    name: "测试文本",
    kind: "text",
    modes: [],
    limits: { maxPromptLength: 8000, maxImages: 0, maxVideos: 0 },
    output: { image: null, video: null },
  },
  {
    id: "test-image",
    name: "测试图片",
    kind: "image",
    modes: ["textToImage", "imageToImage"],
    limits: { maxPromptLength: 2000, maxImages: 4, maxVideos: 0 },
    output: {
      image: { aspectRatios: ["1:1"], resolutions: ["1k"], maxCount: 4 },
      video: null,
    },
  },
  {
    id: "test-video",
    name: "测试视频",
    kind: "video",
    modes: ["textToVideo", "imageToVideo", "firstLastFrame", "referenceVideo"],
    limits: { maxPromptLength: 2000, maxImages: 2, maxVideos: 1 },
    output: {
      image: null,
      video: {
        aspectRatios: ["16:9"],
        resolutions: ["720p"],
        minDuration: 4,
        maxDuration: 12,
        supportsAudio: true,
      },
    },
  },
];

function fakeModels(): ModelsService {
  return {
    getById: async (id: string) => TEST_MODELS.find((model) => model.id === id),
    list: async (kind?: string) =>
      kind ? TEST_MODELS.filter((model) => model.kind === kind) : TEST_MODELS,
  } as unknown as ModelsService;
}

function createService() {
  return new TasksService(
    fakeModels(),
    new TaskEvents(),
    new InMemoryTaskRepository(),
    {
      resolveGenerationModel: async () => {
        throw new ApiException(10004, "模型不存在或未开通", 404);
      },
    } as unknown as ProviderCatalogService,
  );
}

function textDto(overrides: Partial<CreateGenerationDto> = {}): CreateGenerationDto {
  return {
    modelId: "test-text",
    prompt: "写一句测试文案",
    clientRequestId: "node-1:req-12345678",
    ...overrides,
  } as CreateGenerationDto;
}

describe("TasksService", () => {
  it("creates a text task and returns the same task for a repeated idempotency key", async () => {
    const tasks = createService();
    const first = await tasks.create("user-1", "text", textDto());
    const second = await tasks.create("user-1", "text", textDto());

    expect(first.created).toBe(true);
    expect(first.task.kind).toBe("text");
    expect(first.task.status).toBe("queued");
    expect(first.task.mode).toBe("");
    expect(second.created).toBe(false);
    expect(second.task.taskId).toBe(first.task.taskId);
  });

  it("clamps image count to the model limit", async () => {
    const tasks = createService();
    const { task } = await tasks.create("user-1", "image", {
      modelId: "test-image",
      mode: "textToImage",
      prompt: "雨夜霓虹",
      params: { count: 99 },
      clientRequestId: "node-1:req-image-1",
    } as CreateGenerationDto);

    expect(task.status).toBe("queued");
    expect((await tasks.getInternal(task.taskId))?.request.params.count).toBe(4);
  });

  it("rejects an invalid video reference combination", async () => {
    const tasks = createService();
    let error: unknown;
    try {
      await tasks.create("user-1", "video", {
        modelId: "test-video",
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

  it("rejects cancelling a task after it reaches a terminal state", async () => {
    const tasks = createService();
    const { task } = await tasks.create("user-1", "text", textDto());
    await tasks.complete(task.taskId, [
      {
        id: "item_1",
        kind: "text",
        text: "完成",
        modelId: "test-text",
        createdAt: new Date().toISOString(),
      },
    ]);

    expect((await tasks.get("user-1", task.taskId)).status).toBe("succeeded");
    let error: unknown;
    try {
      await tasks.cancel("user-1", task.taskId);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe(20005);
  });

  it("does not expose internal request data in the public task view", async () => {
    const tasks = createService();
    const { task } = await tasks.create("user-1", "text", textDto());
    const publicTask = (await tasks.get("user-1", task.taskId)) as unknown as Record<
      string,
      unknown
    >;

    expect(publicTask.taskId).toBe(task.taskId);
    expect(publicTask.userId).toBeUndefined();
    expect(publicTask.request).toBeUndefined();
  });
});
