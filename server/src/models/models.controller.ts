import { Controller, Get, Query } from "@nestjs/common";
import { ApiException } from "../common/api-exception";
import type { ModelKind } from "./model.types";
import { ModelsService } from "./models.service";

const KINDS: ModelKind[] = ["text", "image", "video"];

@Controller("models")
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  async list(@Query("kind") kind?: string) {
    if (kind !== undefined && !KINDS.includes(kind as ModelKind)) {
      throw new ApiException(20001, "kind 必须是 text / image / video", 422);
    }
    return { models: await this.models.list(kind as ModelKind | undefined) };
  }
}
