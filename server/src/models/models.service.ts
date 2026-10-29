import { Injectable } from "@nestjs/common";
import { ApiException } from "../common/api-exception";
import type { AiModel, ModelKind } from "./model.types";
import { SEED_MODELS } from "./models.seed";

@Injectable()
export class ModelsService {
  private readonly models = SEED_MODELS;

  list(kind?: ModelKind): AiModel[] {
    return this.models
      .filter((model) => !kind || model.kind === kind)
      .map((model) => structuredClone(model));
  }

  getById(id: string): AiModel | undefined {
    return this.models.find((model) => model.id === id);
  }

  require(id: string, kind?: ModelKind): AiModel {
    const model = this.getById(id);
    if (!model) {
      throw new ApiException(10004, "模型不存在或未开通", 404);
    }
    if (kind && model.kind !== kind) {
      throw new ApiException(20001, `模型 ${id} 不是 ${kind} 模型`, 422);
    }
    return structuredClone(model);
  }
}
