import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDER_MODELS = [
  { providerId: "deepseek", modelId: "deepseek-flash", displayName: "DeepSeek Flash", kind: "text" },
  { providerId: "deepseek", modelId: "deepseek-chat", displayName: "DeepSeek Chat", kind: "text" },
  {
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    displayName: "DeepSeek Reasoner",
    kind: "text",
  },
  { providerId: "openai", modelId: "gpt-image-1", displayName: "GPT Image 1", kind: "image" },
  { providerId: "openai", modelId: "dall-e-3", displayName: "DALL·E 3", kind: "image" },
  { providerId: "openai", modelId: "sora-2", displayName: "Sora 2", kind: "video" },
  { providerId: "openai", modelId: "sora-2-pro", displayName: "Sora 2 Pro", kind: "video" },
  {
    providerId: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "FLUX.1 Schnell",
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
    modelId: "Wan-AI/Wan2.1-T2V-14B",
    displayName: "Wan2.1 T2V 14B",
    kind: "video",
  },
  {
    providerId: "siliconflow",
    modelId: "Wan-AI/Wan2.1-I2V-14B-720P",
    displayName: "Wan2.1 I2V 14B",
    kind: "video",
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
        enabled: true,
      },
      create: {
        providerId: model.providerId,
        modelId: model.modelId,
        displayName: model.displayName,
        kind: model.kind,
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
