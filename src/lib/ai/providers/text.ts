import { AI_TIMEOUTS } from "../config";
import { AiRequestError, aiRequest } from "../http";
import { buildTextBody } from "../payload";
import type { AiProvider, ApiTextResult, GenerateInput, GenerationEvent } from "../types";

export const textProvider: AiProvider = {
  async generate(input: GenerateInput, emit: (event: GenerationEvent) => void) {
    const controller = new AbortController();
    void (async () => {
      try {
        const data = await aiRequest<ApiTextResult>("/text/generations", {
          method: "POST",
          body: buildTextBody(input),
          signal: controller.signal,
          timeout: AI_TIMEOUTS.text,
        });
        if (controller.signal.aborted) return;
        emit({
          type: "completed",
          results: [
            {
              id: data.generationId,
              kind: "text",
              text: data.text,
              modelId: data.modelId || input.modelId,
              createdAt: data.completedAt || data.createdAt || new Date().toISOString(),
              ...(data.usage ? { usage: data.usage } : {}),
            },
          ],
          ...(data.usage ? { usage: data.usage } : {}),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        emit({
          type: "failed",
          error:
            error instanceof AiRequestError
              ? { code: error.code, message: error.message }
              : { code: -1, message: error instanceof Error ? error.message : "文本生成失败" },
        });
      }
    })();
    return {
      cancel: () => controller.abort(),
    };
  },
};
