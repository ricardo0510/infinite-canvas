import { AI_TIMEOUTS } from "../config";
import { AiRequestError, aiRequest } from "../http";
import { buildImageBody, buildVideoBody } from "../payload";
import { cancelRemoteTask } from "../taskManager";
import type { AiProvider, ApiSubmitResult, GenerateInput, GenerationEvent } from "../types";

function createTaskProvider(
  path: string,
  buildBody: (input: GenerateInput) => Record<string, unknown>,
): AiProvider {
  return {
    async generate(input: GenerateInput, emit: (event: GenerationEvent) => void) {
      const controller = new AbortController();
      let taskId: string | undefined;
      let canceled = false;
      void (async () => {
        try {
          const data = await aiRequest<ApiSubmitResult>(path, {
            method: "POST",
            body: buildBody(input),
            signal: controller.signal,
            timeout: AI_TIMEOUTS.request,
          });
          taskId = data.taskId;
          if (canceled) {
            await cancelRemoteTask(taskId).catch(() => undefined);
            return;
          }
          emit({ type: "accepted", taskId });
        } catch (error) {
          if (canceled) return;
          emit({
            type: "failed",
            error:
              error instanceof AiRequestError
                ? { code: error.code, message: error.message }
                : { code: -1, message: error instanceof Error ? error.message : "生成任务提交失败" },
          });
        }
      })();
      return {
        cancel: async () => {
          canceled = true;
          controller.abort();
          if (taskId) await cancelRemoteTask(taskId).catch(() => undefined);
        },
      };
    },
  };
}

export const imageProvider = createTaskProvider("/image/generations", buildImageBody);
export const videoProvider = createTaskProvider("/video/generations", buildVideoBody);
