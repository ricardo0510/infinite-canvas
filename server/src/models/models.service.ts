import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiException } from "../common/api-exception";
import type { AiModel, ModelKind } from "./model.types";
import { SEED_MODELS } from "./models.seed";

@Injectable()
export class ModelsService {
  private readonly models: AiModel[];

  constructor(@Optional() config?: ConfigService) {
    const apiKey = config?.get<string>("DEEPSEEK_API_KEY")?.trim();
    this.models = [...SEED_MODELS];
    if (apiKey) {
      const modelId = config?.get<string>("DEEPSEEK_MODEL")?.trim() || "deepseek-4.1-flash";
      if (!this.models.some((model) => model.id === modelId)) {
        this.models.unshift({
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
  }

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
