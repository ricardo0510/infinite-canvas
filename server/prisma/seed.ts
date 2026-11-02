import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedProviderModel = {
  providerId: string;
  modelId: string;
  displayName: string;
  kind: "text" | "image" | "video";
  capabilities?: Record<string, unknown>;
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
    modelId: "gpt-image-1",
    displayName: "GPT Image 1",
    kind: "image",
    capabilities: {
      modes: ["textToImage", "imageToImage"],
      aspectRatios: ["1:1", "3:2", "2:3"],
      resolutions: ["1k", "1.5k", "2k"],
      maxCount: 4,
      maxPromptLength: 4000,
    },
  },
  {
    providerId: "openai",
    modelId: "dall-e-3",
    displayName: "DALL·E 3",
    kind: "image",
    capabilities: {
      modes: ["textToImage"],
      aspectRatios: ["1:1", "16:9", "9:16"],
      resolutions: ["1k", "2k"],
      maxCount: 1,
      maxPromptLength: 4000,
    },
  },
  {
    providerId: "openai",
    modelId: "sora-2",
    displayName: "Sora 2",
    kind: "video",
    capabilities: {
      modes: ["textToVideo"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p", "1080p"],
      minDuration: 5,
      maxDuration: 10,
      supportsAudio: false,
      maxPromptLength: 2000,
    },
  },
  {
    providerId: "openai",
    modelId: "sora-2-pro",
    displayName: "Sora 2 Pro",
    kind: "video",
    capabilities: {
      modes: ["textToVideo"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p", "1080p"],
      minDuration: 5,
      maxDuration: 10,
      supportsAudio: false,
      maxPromptLength: 2000,
    },
  },
  {
    providerId: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "FLUX.1 Schnell",
    kind: "image",
    capabilities: {
      modes: ["textToImage", "imageToImage"],
      aspectRatios: [
        "1:1",
        "3:2",
        "2:3",
        "4:3",
        "3:4",
        "5:4",
        "4:5",
        "16:9",
        "9:16",
        "21:9",
      ],
      resolutions: ["1k", "1.5k", "2k", "3k", "4k"],
      maxCount: 4,
      maxPromptLength: 4000,
    },
  },
  {
    providerId: "siliconflow",
    modelId: "Kwai-Kolors/Kolors",
    displayName: "Kolors",
    kind: "image",
    capabilities: {
      modes: ["textToImage", "imageToImage"],
      aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      resolutions: ["1k", "2k"],
      maxCount: 4,
      maxPromptLength: 4000,
    },
  },
  {
    providerId: "siliconflow",
    modelId: "Wan-AI/Wan2.1-T2V-14B",
    displayName: "Wan2.1 T2V 14B",
    kind: "video",
    capabilities: {
      modes: ["textToVideo"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p"],
      minDuration: 5,
      maxDuration: 5,
      supportsAudio: false,
      maxPromptLength: 2000,
    },
  },
  {
    providerId: "siliconflow",
    modelId: "Wan-AI/Wan2.1-I2V-14B-720P",
    displayName: "Wan2.1 I2V 14B",
    kind: "video",
    capabilities: {
      modes: ["imageToVideo", "firstLastFrame"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720p"],
      minDuration: 5,
      maxDuration: 5,
      supportsAudio: false,
      maxImages: 2,
      maxPromptLength: 2000,
    },
  },
] as const;

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
    update: {},
    create: {
      id: "siliconflow",
      name: "SiliconFlow",
      type: "siliconflow",
      adapter: "openai-compatible",
      authType: "bearer",
      docsUrl: "https://docs.siliconflow.cn",
      supportsModels: true,
      baseUrl: "https://api.siliconflow.cn/v1",
    },
  });

  for (const model of PROVIDER_MODELS) {
    await prisma.providerModel.upsert({
      where: { providerId_modelId: { providerId: model.providerId, modelId: model.modelId } },
      update: {
        displayName: model.displayName,
        kind: model.kind,
        capabilities: model.capabilities ?? {},
        enabled: true,
      },
      create: {
        providerId: model.providerId,
        modelId: model.modelId,
        displayName: model.displayName,
        kind: model.kind,
        capabilities: model.capabilities ?? {},
        source: "manual",
        enabled: true,
      },
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

  console.log("Seeded providers and text/image/video provider models");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
