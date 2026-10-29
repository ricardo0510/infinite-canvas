import { Injectable, Optional, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, type ModelConfig } from "@prisma/client";
import { ApiException } from "../common/api-exception";
import type { AiModel, ModelKind } from "./model.types";
import { SEED_MODELS } from "./models.seed";

const CACHE_MS = 10_000;

function fallbackModels(config?: ConfigService): AiModel[] {
  const models = [...SEED_MODELS];
  const apiKey = config?.get<string>("DEEPSEEK_API_KEY")?.trim();
  if (apiKey) {
    const modelId = config?.get<string>("DEEPSEEK_MODEL")?.trim() || "deepseek-4.1-flash";
    if (!models.some((model) => model.id === modelId)) {
      models.unshift({
        id: modelId,
        name: "DeepSeek 4.1 Flash",
        kind: "text",
        modes: [],
        description: "DeepSeek 4.1 Flash（OpenAI 兼容接口）",
        limits: { maxPromptLength: 60_000, maxImages: 0, maxVideos: 0 },
        output: { image: null, video: null },
      });
    }
  }
  return models;
}

function fromRow(row: ModelConfig): AiModel {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ModelKind,
    modes: row.modes as string[],
    ...(row.description ? { description: row.description } : {}),
    ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}),
    limits: row.limits as AiModel["limits"],
    output: row.output as AiModel["output"],
    ...(row.params ? { params: row.params as AiModel["params"] } : {}),
    ...(row.pricing ? { pricing: row.pricing as AiModel["pricing"] } : {}),
  };
}

@Injectable()
export class ModelsService implements OnModuleDestroy {
  private readonly prisma: PrismaClient | null;
  private readonly fallback: AiModel[];
  private readonly hasDeepseekKey: boolean;
  private cache: AiModel[] | null = null;
  private cachedAt = 0;

  constructor(@Optional() config?: ConfigService) {
    const databaseUrl = config?.get<string>("DATABASE_URL");
    this.prisma = databaseUrl
      ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
      : null;
    this.fallback = fallbackModels(config);
    this.hasDeepseekKey = Boolean(config?.get<string>("DEEPSEEK_API_KEY")?.trim());
  }

  async list(kind?: ModelKind): Promise<AiModel[]> {
    const models = await this.load();
    return models
      .filter((model) => !kind || model.kind === kind)
      .map((model) => structuredClone(model));
  }

  async getById(id: string): Promise<AiModel | undefined> {
    return (await this.load()).find((model) => model.id === id);
  }

  async require(id: string, kind?: ModelKind): Promise<AiModel> {
    const model = await this.getById(id);
    if (!model) {
      throw new ApiException(10004, "模型不存在或未开通", 404);
    }
    if (kind && model.kind !== kind) {
      throw new ApiException(20001, `模型 ${id} 不是 ${kind} 模型`, 422);
    }
    return structuredClone(model);
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }

  private async load(): Promise<AiModel[]> {
    if (this.cache && Date.now() - this.cachedAt < CACHE_MS) return this.cache;
    if (!this.prisma) return this.fallback;

    try {
      const rows = await this.prisma.modelConfig.findMany({
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      const models = rows
        .filter((row) => row.providerId !== "deepseek" || this.hasDeepseekKey)
        .map(fromRow);
      this.cache = models;
      this.cachedAt = Date.now();
      return models;
    } catch {
      return this.fallback;
    }
  }
}
