import { PrismaClient } from "@prisma/client";
import { SEED_MODELS } from "../src/models/models.seed";

const prisma = new PrismaClient();

function modelData(model: (typeof SEED_MODELS)[number], sortOrder: number) {
  return {
    id: model.id,
    name: model.name,
    kind: model.kind,
    modes: model.modes,
    description: model.description ?? null,
    logoUrl: model.logoUrl ?? null,
    limits: model.limits,
    output: model.output,
    params: model.params ?? null,
    pricing: model.pricing ?? null,
    providerId: "mock",
    providerModel: model.id,
    enabled: true,
    sortOrder,
  };
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: "默认用户" },
  });

  await prisma.providerConfig.upsert({
    where: { id: "mock" },
    update: {},
    create: {
      id: "mock",
      name: "Mock Provider",
      type: "mock",
      baseUrl: "local://mock",
    },
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

  for (const modelId of ["deepseek-flash", "deepseek-chat", "deepseek-reasoner"]) {
    await prisma.providerModel.upsert({
      where: { providerId_modelId: { providerId: "deepseek", modelId } },
      update: { enabled: true },
      create: {
        providerId: "deepseek",
        modelId,
        displayName: modelId,
        kind: "text",
        source: "manual",
        enabled: true,
      },
    });
  }

  for (const [index, model] of SEED_MODELS.entries()) {
    await prisma.modelConfig.upsert({
      where: { id: model.id },
      update: {},
      create: modelData(model, index),
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

  console.log("Seeded mock models and DeepSeek provider/model");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
