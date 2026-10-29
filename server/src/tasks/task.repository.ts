import { Injectable } from "@nestjs/common";
import type { InternalTask, TaskKind } from "./task.types";

export const TASK_REPOSITORY = "TASK_REPOSITORY";

export interface TaskRepository {
  create(task: InternalTask): Promise<void>;
  findByClientRequest(
    userId: string,
    kind: TaskKind,
    clientRequestId: string,
  ): Promise<InternalTask | undefined>;
  findById(taskId: string): Promise<InternalTask | undefined>;
  listActive(): Promise<InternalTask[]>;
  update(task: InternalTask): Promise<void>;
}

@Injectable()
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, InternalTask>();

  async create(task: InternalTask): Promise<void> {
    this.tasks.set(task.taskId, structuredClone(task));
  }

  async findByClientRequest(
    userId: string,
    kind: TaskKind,
    clientRequestId: string,
  ): Promise<InternalTask | undefined> {
    for (const task of this.tasks.values()) {
      if (
        task.userId === userId &&
        task.kind === kind &&
        task.clientRequestId === clientRequestId
      ) {
        return structuredClone(task);
      }
    }
    return undefined;
  }

  async findById(taskId: string): Promise<InternalTask | undefined> {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  async listActive(): Promise<InternalTask[]> {
    return [...this.tasks.values()]
      .filter((task) => task.status === "queued" || task.status === "running")
      .map((task) => structuredClone(task));
  }

  async update(task: InternalTask): Promise<void> {
    this.tasks.set(task.taskId, structuredClone(task));
  }
}
