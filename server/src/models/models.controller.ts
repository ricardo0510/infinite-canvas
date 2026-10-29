import { Controller, Get, Query } from "@nestjs/common";
import { ProviderCatalogService } from "../byok/provider-catalog.service";
import { ApiException } from "../common/api-exception";
import type { AuthUser } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import type { ModelKind } from "./model.types";
import { ModelsService } from "./models.service";

const KINDS: ModelKind[] = ["text", "image", "video"];

@Controller("models")
export class ModelsController {
  constructor(
    private readonly models: ModelsService,
    private readonly catalog: ProviderCatalogService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query("kind") kind?: string) {
    if (kind !== undefined && !KINDS.includes(kind as ModelKind)) {
      throw new ApiException(20001, "kind 必须为 text / image / video", 422);
    }
    const modelKind = kind as ModelKind | undefined;
    const platform = await this.models.list(modelKind);
    const byok = await this.catalog.listUserAiModels(user.id, modelKind).catch(() => []);

    const seen = new Set<string>();
    const models = [...byok, ...platform].filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
    return { models };
  }
}
