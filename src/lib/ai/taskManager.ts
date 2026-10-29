import { AI_TIMEOUTS, getAiRealtimeBase } from "./config";
import { aiRequest } from "./http";
import { onRealtimeMessage, subscribeTasks, unsubscribeTasks } from "./realtime";
import {
  addPendingTask,
  listPendingTasks,
  removePendingTask,
  removePendingTaskForNode,
  updatePendingTask,
  type PendingTask,
} from "./taskCache";
import type { ApiTask } from "./types";

export type { PendingTask } from "./taskCache";

type TaskHandler = (task: ApiTask, nodeId: string) => void;

type WatchedTask = {
  taskId: string;
  nodeId: string;
  kind: PendingTask["kind"];
  modelId: string;
  prompt: string;
  startedAt: number;
  timeout: number | null;
};

const watched = new Map<string, WatchedTask>();
let handler: TaskHandler | null = null;
let realtimeBound = false;

export function setTaskHandler(next: TaskHandler): void {
  handler = next;
}

export async function cancelRemoteTask(taskId: string): Promise<ApiTask> {
  return aiRequest<ApiTask>(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: "POST",
    timeout: AI_TIMEOUTS.request,
  });
}

function isTerminal(status: ApiTask["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function failedTask(task: WatchedTask, code: number, message: string): ApiTask {
  const now = new Date().toISOString();
  return {
    taskId: task.taskId,
    kind: task.kind,
    status: "failed",
    progress: 0,
    modelId: task.modelId,
    mode: "",
    result: null,
    error: { code, message },
    createdAt: new Date(task.startedAt).toISOString(),
    updatedAt: now,
  };
}

function applyTask(update: ApiTask, task: WatchedTask): void {
  if (update.progress !== undefined) updatePendingTask(task.taskId, { progress: update.progress });
  handler?.(update, task.nodeId);
  if (isTerminal(update.status)) unwatchTask(task.taskId);
}

function bindRealtime(): void {
  if (realtimeBound) return;
  realtimeBound = true;
  onRealtimeMessage((message) => {
    if (message.type !== "task.updated") return;
    const task = (message.data as { task?: ApiTask } | undefined)?.task;
    if (!task) return;
    const watchedTask = watched.get(task.taskId);
    if (!watchedTask) return;
    applyTask(task, watchedTask);
  });
}

export function watchTask(taskId: string, nodeId: string, meta?: Partial<PendingTask>): void {
  if (!taskId || watched.has(taskId)) return;
  const cached = listPendingTasks().find((item) => item.taskId === taskId);
  const task: WatchedTask = {
    taskId,
    nodeId,
    kind: meta?.kind ?? cached?.kind ?? "image",
    modelId: meta?.modelId ?? cached?.modelId ?? "",
    prompt: meta?.prompt ?? cached?.prompt ?? "",
    startedAt: meta?.startedAt ?? cached?.startedAt ?? Date.now(),
    timeout: null,
  };

  if (!getAiRealtimeBase()) {
    removePendingTask(taskId);
    handler?.(failedTask(task, -1, "未配置实时通道，无法接收任务结果"), nodeId);
    return;
  }

  bindRealtime();
  watched.set(taskId, task);
  subscribeTasks([taskId]);
  addPendingTask({
    taskId,
    nodeId: task.nodeId,
    kind: task.kind,
    modelId: task.modelId,
    prompt: task.prompt,
    startedAt: task.startedAt,
  });

  // 只做超时保护，不轮询；任务进度完全依赖 WebSocket 推送。
  task.timeout = window.setTimeout(() => {
    if (!watched.has(taskId)) return;
    handler?.(failedTask(task, 30002, "任务超时，请稍后重试"), nodeId);
    unwatchTask(taskId);
  }, AI_TIMEOUTS.task);
}

export function unwatchTask(taskId: string): void {
  const task = watched.get(taskId);
  if (task?.timeout !== null && task?.timeout !== undefined) window.clearTimeout(task.timeout);
  watched.delete(taskId);
  unsubscribeTasks([taskId]);
  removePendingTask(taskId);
}

export function disposeNodeTasks(nodeId: string): void {
  const taskIds: string[] = [];
  for (const [taskId, task] of watched) {
    if (task.nodeId !== nodeId) continue;
    if (task.timeout !== null) window.clearTimeout(task.timeout);
    watched.delete(taskId);
    taskIds.push(taskId);
  }
  if (taskIds.length > 0) unsubscribeTasks(taskIds);
  removePendingTaskForNode(nodeId);
}

export function resumePendingTasks(): void {
  for (const task of listPendingTasks()) {
    watchTask(task.taskId, task.nodeId, task);
  }
}
