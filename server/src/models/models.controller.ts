import { Controller, Get, Query } from "@nestjs/common";
import { ProviderCatalogService } from "../byok/provider-catalog.service";
import { ApiException } from "../common/api-exception";
import type { AuthUser } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { isModelKind, MODEL_KINDS, type ModelKind } from "./model.types";

@Controller("models")
export class ModelsController {
  constructor(private readonly catalog: ProviderCatalogService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query("kind") kind?: string) {
    if (kind !== undefined && !isModelKind(kind)) {
      throw new ApiException(20001, `kind 必须为 ${MODEL_KINDS.join(" / ")}`, 422);
    }
    const modelKind: ModelKind | undefined = isModelKind(kind) ? kind : undefined;
    return { models: await this.catalog.listUserAiModels(user.id, modelKind) };
  }
}
