import { AI_TIMEOUTS } from "./config";
import { AiRequestError, aiRequest } from "./http";
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
  kind: "image" | "video";
  modelId: string;
  prompt: string;
  startedAt: number;
  timer: number | null;
  inFlight: boolean;
  failures: number;
};

const watched = new Map<string, WatchedTask>();
let handler: TaskHandler | null = null;
let realtimeBound = false;

export function setTaskHandler(next: TaskHandler): void {
  handler = next;
}

export async function getTask(taskId: string): Promise<ApiTask> {
  return aiRequest<ApiTask>(`/tasks/${encodeURIComponent(taskId)}`, { timeout: AI_TIMEOUTS.request });
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

async function poll(task: WatchedTask): Promise<void> {
  if (task.inFlight) return;
  task.inFlight = true;
  try {
    const update = await getTask(task.taskId);
    if (!watched.has(task.taskId)) return;
    task.failures = 0;
    applyTask(update, task);
  } catch (error) {
    task.failures += 1;
    const code = error instanceof AiRequestError ? error.code : -1;
    const message = error instanceof Error ? error.message : "任务查询失败";
    if (task.failures >= 5) {
      handler?.(failedTask(task, code, message), task.nodeId);
      unwatchTask(task.taskId);
    }
  } finally {
    task.inFlight = false;
  }
}

export function watchTask(taskId: string, nodeId: string, meta?: Partial<PendingTask>): void {
  if (!taskId || watched.has(taskId)) return;
  bindRealtime();
  const cached = listPendingTasks().find((item) => item.taskId === taskId);
  const task: WatchedTask = {
    taskId,
    nodeId,
    kind: meta?.kind ?? cached?.kind ?? "image",
    modelId: meta?.modelId ?? cached?.modelId ?? "",
    prompt: meta?.prompt ?? cached?.prompt ?? "",
    startedAt: meta?.startedAt ?? cached?.startedAt ?? Date.now(),
    timer: null,
    inFlight: false,
    failures: 0,
  };
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
  void poll(task);
  task.timer = window.setInterval(() => void poll(task), AI_TIMEOUTS.poll);
}

export function unwatchTask(taskId: string): void {
  const task = watched.get(taskId);
  if (task?.timer !== null && task?.timer !== undefined) window.clearInterval(task.timer);
  watched.delete(taskId);
  unsubscribeTasks([taskId]);
  removePendingTask(taskId);
}

export function disposeNodeTasks(nodeId: string): void {
  const taskIds: string[] = [];
  for (const [taskId, task] of watched) {
    if (task.nodeId !== nodeId) continue;
    if (task.timer !== null) window.clearInterval(task.timer);
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
