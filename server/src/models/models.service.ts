import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ModelConfig } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AiModel, ModelKind } from "./model.types";
import { isModelKind } from "./model.types";

const CACHE_MS = 10_000;

function fromRow(row: ModelConfig): AiModel {
  return {
    id: row.id,
    name: row.name,
    kind: isModelKind(row.kind) ? row.kind : "text",
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
export class ModelsService {
  private readonly fallback: AiModel[] = [];
  private readonly hasDatabase: boolean;
  private readonly hasDeepseekKey: boolean;
  private cache: AiModel[] | null = null;
  private cachedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.hasDatabase = Boolean(config.get<string>("DATABASE_URL"));
    this.hasDeepseekKey = Boolean(config.get<string>("DEEPSEEK_API_KEY")?.trim());
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

  private async load(): Promise<AiModel[]> {
    if (this.cache && Date.now() - this.cachedAt < CACHE_MS) return this.cache;
    if (!this.hasDatabase) return this.fallback;

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
