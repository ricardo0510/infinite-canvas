import { useCanvasStore } from "../../store/canvasStore";
import type {
  CanvasNode,
  GenerationKind,
  GenerationMeta,
  GenerationResultItem,
} from "../../types";
import { AiRequestError } from "./http";
import { getModel, defaultModelFor, defaultParams } from "./models";
import { providerFor } from "./provider";
import { collectUpstream, composePrompt, mapUpstreamReferences } from "./refs";
import { uploadReferences } from "./media";
import {
  cancelRemoteTask,
  disposeNodeTasks,
  resumePendingTasks,
  setTaskHandler,
  unwatchTask,
  watchTask,
  type PendingTask,
} from "./taskManager";
import type { ApiTask, GenerationEvent } from "./types";

type ActiveJob = {
  cancel: () => Promise<void> | void;
};

const activeJobs = new Map<string, ActiveJob>();
let initialized = false;

export function kindOfNode(node: CanvasNode | undefined): GenerationKind | null {
  if (node?.type === "text") return "text";
  if (node?.type === "image") return "image";
  if (node?.type === "video") return "video";
  return null;
}

export function defaultGeneration(kind: GenerationKind): GenerationMeta {
  return {
    kind,
    prompt: "",
    modelId: "",
    status: "idle",
    results: [],
  };
}

function generationOf(node: CanvasNode, kind: GenerationKind): GenerationMeta {
  return (node.data as { generation?: GenerationMeta }).generation ?? defaultGeneration(kind);
}

export function patchGeneration(nodeId: string, patch: Partial<GenerationMeta>): void {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) return;
  const current = generationOf(node, kind);
  useCanvasStore.getState().updateNodeData(nodeId, {
    generation: { ...current, ...patch, updatedAt: new Date().toISOString() },
  });
}

function patchNodeDisplay(nodeId: string, data: Record<string, unknown>): void {
  useCanvasStore.getState().updateNodeData(nodeId, data);
}

function errorOf(error: unknown): { code: number; message: string } {
  if (error instanceof AiRequestError) return { code: error.code, message: error.message };
  return { code: -1, message: error instanceof Error ? error.message : "生成失败" };
}

function markDownstreamStale(nodeId: string): void {
  const state = useCanvasStore.getState();
  const targets = state.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
  for (const targetId of targets) {
    const target = state.nodes.find((node) => node.id === targetId);
    const generation = target
      ? (target.data as { generation?: GenerationMeta }).generation
      : undefined;
    if (!target || !generation) continue;
    state.updateNodeData(target.id, {
      generation: { ...generation, stale: true },
    });
  }
}

function finishGeneration(nodeId: string, results: GenerationResultItem[]): void {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node) return;
  const kind = kindOfNode(node);
  if (!kind) return;
  const current = generationOf(node, kind);
  const incomingIds = new Set(results.map((item) => item.id));
  const merged = [...current.results.filter((item) => !incomingIds.has(item.id)), ...results].slice(-20);
  const active = results[0] ?? merged[merged.length - 1];
  const next: GenerationMeta = {
    ...current,
    status: "succeeded",
    progress: 100,
    taskId: undefined,
    error: undefined,
    results: merged,
    activeResultId: active?.id,
    updatedAt: new Date().toISOString(),
  };
  const display: Record<string, unknown> = { generation: next };
  if (kind === "text") {
    const text = results.find((item): item is Extract<GenerationResultItem, { kind: "text" }> => item.kind === "text");
    if (text) display.text = text.text;
  } else if (kind === "image") {
    const image = results.find((item): item is Extract<GenerationResultItem, { kind: "image" }> => item.kind === "image");
    if (image) {
      display.src = image.url;
      display.alt = current.prompt.slice(0, 80);
    }
  } else {
    const video = results.find((item): item is Extract<GenerationResultItem, { kind: "video" }> => item.kind === "video");
    if (video) {
      display.src = video.url;
      display.thumbnailUrl = video.thumbnailUrl ?? "";
      display.alt = current.prompt.slice(0, 80);
    }
  }
  patchNodeDisplay(nodeId, display);
  activeJobs.delete(nodeId);
  markDownstreamStale(nodeId);
}

function failGeneration(nodeId: string, error: { code: number; message: string }): void {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) return;
  const current = generationOf(node, kind);
  useCanvasStore.getState().updateNodeData(nodeId, {
    generation: {
      ...current,
      status: "failed",
      progress: 0,
      taskId: undefined,
      error,
      updatedAt: new Date().toISOString(),
    },
  });
  activeJobs.delete(nodeId);
}

function handleTaskUpdate(task: ApiTask, nodeId: string): void {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) {
    unwatchTask(task.taskId);
    return;
  }
  if (task.status === "succeeded") {
    const items = (task.result?.items ?? []).filter(
      (item): item is GenerationResultItem => item.kind === kind,
    );
    if (items.length === 0) {
      failGeneration(nodeId, { code: -1, message: "任务成功但未返回结果" });
      unwatchTask(task.taskId);
      return;
    }
    finishGeneration(nodeId, items);
    unwatchTask(task.taskId);
    return;
  }
  if (task.status === "failed") {
    failGeneration(nodeId, task.error ?? { code: -1, message: "生成失败" });
    unwatchTask(task.taskId);
    return;
  }
  if (task.status === "canceled") {
    const current = generationOf(node, kind);
    useCanvasStore.getState().updateNodeData(nodeId, {
      generation: { ...current, status: "canceled", progress: 0, taskId: undefined },
    });
    activeJobs.delete(nodeId);
    unwatchTask(task.taskId);
    return;
  }
  const current = generationOf(node, kind);
  useCanvasStore.getState().updateNodeData(nodeId, {
    generation: {
      ...current,
      status: task.status,
      ...(task.progress !== undefined ? { progress: task.progress } : {}),
    },
  });
}

function applyEvent(nodeId: string, event: GenerationEvent): void {
  if (event.type === "accepted") {
    const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
    const kind = kindOfNode(node);
    if (!node || !kind) return;
    const current = generationOf(node, kind);
    useCanvasStore.getState().updateNodeData(nodeId, {
      generation: { ...current, status: "running", taskId: event.taskId },
    });
    if (kind === "image" || kind === "video") {
      const meta: Partial<PendingTask> = {
        kind,
        modelId: current.modelId,
        prompt: current.prompt,
        startedAt: Date.now(),
      };
      watchTask(event.taskId, nodeId, meta);
    }
    return;
  }
  if (event.type === "progress") {
    const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
    const kind = kindOfNode(node);
    if (!node || !kind) return;
    patchGeneration(nodeId, { status: "running", progress: event.progress });
    return;
  }
  if (event.type === "completed") {
    finishGeneration(nodeId, event.results);
    return;
  }
  failGeneration(nodeId, event.error);
}

export async function generateNode(nodeId: string): Promise<void> {
  const state = useCanvasStore.getState();
  const node = state.nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) return;
  if (activeJobs.has(nodeId)) return;
  const current = generationOf(node, kind);
  if (current.status === "queued" || current.status === "running") return;

  const prompt = current.prompt.trim();
  if (!prompt) throw new Error("请先填写提示词");

  const selected = current.modelId ? await getModel(current.modelId) : undefined;
  const model = selected ?? (await defaultModelFor(kind));
  if (!model) throw new Error("没有可用的生成模型");
  if (prompt.length > model.limits.maxPromptLength) {
    throw new Error(`提示词不能超过 ${model.limits.maxPromptLength} 个字符`);
  }

  const upstream = collectUpstream(nodeId, state.nodes, state.edges);
  let mode = current.mode;
  if (kind === "image") {
    const hasImage = upstream.references.some((item) => item.kind === "image");
    if (mode !== "textToImage" && mode !== "imageToImage") {
      mode = hasImage ? "imageToImage" : "textToImage";
    }
    if (hasImage && mode === "textToImage") mode = "imageToImage";
    if (mode === "imageToImage" && !hasImage) throw new Error("图生图需要至少一张上游图片");
  } else if (kind === "video") {
    const hasVideo = upstream.references.some((item) => item.kind === "video");
    const images = upstream.references.filter((item) => item.kind === "image");
    if (!mode || !["textToVideo", "imageToVideo", "firstLastFrame", "referenceVideo"].includes(mode)) {
      mode = hasVideo ? "referenceVideo" : images.length > 0 ? "imageToVideo" : "textToVideo";
    }
    if (hasVideo) mode = "referenceVideo";
    else if (mode === "textToVideo" && images.length > 0) mode = "imageToVideo";
    if (mode === "imageToVideo" && images.length === 0) throw new Error("图生视频需要至少一张上游图片");
    if (mode === "firstLastFrame" && images.length < 2) throw new Error("首尾帧模式需要两张上游图片");
    if (mode === "referenceVideo" && !hasVideo) throw new Error("参考视频模式需要至少一个上游视频");
  }

  const references = mapUpstreamReferences(kind, mode, upstream.references);
  const params = { ...defaultParams(model), ...current.params };
  const mergedPrompt = composePrompt(prompt, upstream.texts);

  state.commit();
  patchGeneration(nodeId, {
    kind,
    prompt,
    modelId: model.id,
    mode,
    params,
    status: kind === "text" ? "running" : "queued",
    progress: 0,
    taskId: undefined,
    error: undefined,
    stale: false,
  });

  try {
    const uploaded = await uploadReferences(references);
    const provider = providerFor(kind);
    const handle = await provider.generate(
      {
        nodeId,
        kind,
        prompt: mergedPrompt,
        modelId: model.id,
        mode,
        params,
        references: uploaded,
        clientRequestId: `${nodeId}:${crypto.randomUUID()}`,
      },
      (event) => applyEvent(nodeId, event),
    );
    activeJobs.set(nodeId, handle);
  } catch (error) {
    const failure = errorOf(error);
    failGeneration(nodeId, failure);
    throw error;
  }
}

export async function cancelGeneration(nodeId: string): Promise<void> {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) return;
  const current = generationOf(node, kind);
  const job = activeJobs.get(nodeId);
  activeJobs.delete(nodeId);
  if (job) await job.cancel();
  if (current.taskId) {
    if (!job) await cancelRemoteTask(current.taskId).catch(() => undefined);
    unwatchTask(current.taskId);
  }
  useCanvasStore.getState().updateNodeData(nodeId, {
    generation: {
      ...current,
      status: "canceled",
      progress: 0,
      taskId: undefined,
      updatedAt: new Date().toISOString(),
    },
  });
}

export function activateResult(nodeId: string, resultId: string): void {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId);
  const kind = kindOfNode(node);
  if (!node || !kind) return;
  const current = generationOf(node, kind);
  const result = current.results.find((item) => item.id === resultId);
  if (!result) return;
  const display: Record<string, unknown> = {
    generation: { ...current, activeResultId: result.id },
  };
  if (result.kind === "text") display.text = result.text;
  if (result.kind === "image") {
    display.src = result.url;
    display.alt = current.prompt.slice(0, 80);
  }
  if (result.kind === "video") {
    display.src = result.url;
    display.thumbnailUrl = result.thumbnailUrl ?? "";
    display.alt = current.prompt.slice(0, 80);
  }
  useCanvasStore.getState().updateNodeData(nodeId, display);
}

export function initAiController(): void {
  if (initialized) return;
  initialized = true;
  setTaskHandler(handleTaskUpdate);
  useCanvasStore.subscribe((state, previous) => {
    const ids = new Set(state.nodes.map((node) => node.id));
    for (const node of previous.nodes) {
      if (ids.has(node.id)) continue;
      const job = activeJobs.get(node.id);
      if (job) void job.cancel();
      activeJobs.delete(node.id);
      disposeNodeTasks(node.id);
    }
  });
  resumePendingTasks();
}
