import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedProviderModel = {
  providerId: string;
  modelId: string;
  displayName: string;
  kind: "text" | "image" | "video";
  capabilities?: Record<string, unknown>;
  enabled?: boolean;
};

const PROVIDER_MODELS: SeedProviderModel[] = [
  { providerId: "deepseek", modelId: "deepseek-flash", displayName: "DeepSeek Flash", kind: "text" },
  { providerId: "deepseek", modelId: "deepseek-chat", displayName: "DeepSeek Chat", kind: "text" },
  {
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner",
    kind: "text",
  },
  {
    providerId: "openai",
    modelId: "gpt-image-2.5-sunburst",
    displayName: "GPT Image 2.5 Sunburst",
    kind: "image",
  },
  {
    providerId: "openai",
    modelId: "gpt-image-2.5-flare",
    displayName: "GPT Image 2.5 Flare",
    kind: "image",
  },
  {
    providerId: "siliconflow",
    modelId: "Qwen/Qwen-Image",
    displayName: "Qwen Image",
    kind: "image",
  },
  {
    providerId: "siliconflow",
    modelId: "Kwai-Kolors/Kolors",
    displayName: "Kolors",
    kind: "image",
  },
  {
    providerId: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "FLUX.1 Schnell",
    kind: "image",
    enabled: false,
  },
  {
    providerId: "siliconflow",
    modelId: "Wan-AI/Wan2.2-T2V-A14B",
    displayName: "Wan2.2 T2V A14B",
    kind: "video",
    capabilities: {
      source: "SiliconFlow Video Generation API docs",
      verifiedAt: "2026-11-02",
      modes: ["textToVideo"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p"],
      minDuration: 5,
      maxDuration: 5,
      supportsAudio: false,
      maxPromptLength: 2000,
    },
  },
];

// 旧版估算/已下线的数据，执行 seed 时一并清理。
const OBSOLETE_PROVIDER_MODELS = {
  openai: ["gpt-image-1", "dall-e-3", "sora-2", "sora-2-pro"],
  siliconflow: ["Wan-AI/Wan2.1-T2V-14B", "Wan-AI/Wan2.1-I2V-14B-720P"],
} as const;

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: "默认用户" },
  });

  const deepseekModel = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
  await prisma.providerConfig.upsert({
    where: { id: "deepseek" },
    update: {
      adapter: "openai-compatible",
      authType: "bearer",
      docsUrl: "https://api-docs.deepseek.com",
      supportsModels: true,
    },
    create: {
      id: "deepseek",
      name: "DeepSeek",
      type: "deepseek",
      adapter: "openai-compatible",
      authType: "bearer",
      docsUrl: "https://api-docs.deepseek.com",
      supportsModels: true,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: deepseekModel,
    },
  });

  await prisma.providerConfig.upsert({
    where: { id: "openai" },
    update: {},
    create: {
      id: "openai",
      name: "OpenAI",
      type: "openai",
      adapter: "openai-compatible",
      authType: "bearer",
      docsUrl: "https://platform.openai.com/docs",
      supportsModels: true,
      baseUrl: "https://api.openai.com/v1",
    },
  });

  await prisma.providerConfig.upsert({
    where: { id: "siliconflow" },
    update: {
      extra: { imageSizeField: "image_size", imageResponse: "images" },
    },
    create: {
      id: "siliconflow",
      name: "SiliconFlow",
      type: "siliconflow",
      adapter: "openai-compatible",
      authType: "bearer",
      docsUrl: "https://docs.siliconflow.cn",
      supportsModels: true,
      baseUrl: "https://api.siliconflow.cn/v1",
      extra: { imageSizeField: "image_size", imageResponse: "images" },
    },
  });

  for (const model of PROVIDER_MODELS) {
    await prisma.providerModel.upsert({
      where: { providerId_modelId: { providerId: model.providerId, modelId: model.modelId } },
      update: {
        displayName: model.displayName,
        kind: model.kind,
        capabilities: model.capabilities ?? {},
        enabled: model.enabled ?? true,
      },
      create: {
        providerId: model.providerId,
        modelId: model.modelId,
        displayName: model.displayName,
        kind: model.kind,
        capabilities: model.capabilities ?? {},
        source: "manual",
        enabled: model.enabled ?? true,
      },
    });
  }

  for (const [providerId, modelIds] of Object.entries(OBSOLETE_PROVIDER_MODELS)) {
    await prisma.providerModel.deleteMany({
      where: { providerId, modelId: { in: [...modelIds] } },
    });
  }

  await prisma.modelConfig.upsert({
    where: { id: deepseekModel },
    update: {},
    create: {
      id: deepseekModel,
      name: "DeepSeek 4.1 Flash",
      kind: "text",
      modes: [],
      description: "DeepSeek 4.1 Flash（OpenAI 兼容接口）",
      limits: { maxPromptLength: 60000, maxImages: 0, maxVideos: 0 },
      output: { image: null, video: null },
      providerId: "deepseek",
      providerModel: deepseekModel,
      enabled: true,
      sortOrder: -1,
    },
  });

  // 清理旧版本内置的模拟数据
  await prisma.modelConfig.deleteMany({
    where: { id: { in: ["mock-text", "mock-image", "mock-video"] } },
  });
  await prisma.providerConfig.deleteMany({ where: { id: "mock" } });

  console.log("Seeded verified provider models; removed obsolete/fake model data");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
