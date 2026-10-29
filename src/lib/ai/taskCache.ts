const KEY = "infinite-canvas:ai-tasks";
const MAX_AGE = 30 * 60 * 1000;

export type PendingTask = {
  taskId: string;
  nodeId: string;
  kind: "image" | "video";
  modelId: string;
  prompt: string;
  startedAt: number;
  progress?: number;
};

function read(): PendingTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is PendingTask =>
        typeof item === "object" &&
        item !== null &&
        typeof item.taskId === "string" &&
        typeof item.nodeId === "string" &&
        (item.kind === "image" || item.kind === "video") &&
        typeof item.startedAt === "number",
    );
  } catch {
    return [];
  }
}

function write(tasks: PendingTask[]): void {
  try {
    if (tasks.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Storage can be unavailable; tasks still run in memory.
  }
}

export function listPendingTasks(): PendingTask[] {
  const now = Date.now();
  const tasks = read().filter((task) => now - task.startedAt < MAX_AGE);
  if (tasks.length !== read().length) write(tasks);
  return tasks;
}

export function addPendingTask(task: PendingTask): void {
  const tasks = read().filter((item) => item.taskId !== task.taskId);
  tasks.push(task);
  write(tasks);
}

export function updatePendingTask(taskId: string, patch: Partial<PendingTask>): void {
  const tasks = read().map((item) => (item.taskId === taskId ? { ...item, ...patch } : item));
  write(tasks);
}

export function removePendingTask(taskId: string): void {
  write(read().filter((item) => item.taskId !== taskId));
}

export function removePendingTaskForNode(nodeId: string): void {
  write(read().filter((item) => item.nodeId !== nodeId));
}

export function clearPendingTasks(): void {
  write([]);
}
