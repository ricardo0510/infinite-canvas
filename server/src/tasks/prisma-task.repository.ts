import { Prisma, PrismaClient, type Task as TaskRow } from "@prisma/client";
import type { OnModuleDestroy } from "@nestjs/common";
import type { ApiTask, InternalTask, TaskKind, TaskStatus } from "./task.types";

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function createData(task: InternalTask): Prisma.TaskCreateInput {
  return {
    id: task.taskId,
    userId: task.userId,
    kind: task.kind,
    status: task.status,
    progress: task.progress,
    modelId: task.modelId,
    mode: task.mode,
    request: task.request as unknown as Prisma.InputJsonValue,
    result: jsonOrNull(task.result),
    error: jsonOrNull(task.error),
    clientRequestId: task.clientRequestId,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    expiresAt: task.expiresAt ? new Date(task.expiresAt) : null,
  };
}

function updateData(task: InternalTask): Prisma.TaskUpdateInput {
  return {
    status: task.status,
    progress: task.progress,
    result: jsonOrNull(task.result),
    error: jsonOrNull(task.error),
    expiresAt: task.expiresAt ? new Date(task.expiresAt) : null,
  };
}

function fromRow(row: TaskRow): InternalTask {
  return {
    taskId: row.id,
    kind: row.kind as TaskKind,
    status: row.status as TaskStatus,
    progress: row.progress,
    modelId: row.modelId,
    mode: row.mode,
    result: row.result as unknown as ApiTask["result"],
    error: row.error as unknown as ApiTask["error"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    userId: row.userId,
    clientRequestId: row.clientRequestId,
    request: row.request as unknown as InternalTask["request"],
  };
}

export class PrismaTaskRepository implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async create(task: InternalTask): Promise<void> {
    await this.prisma.task.create({ data: createData(task) });
  }

  async findByClientRequest(
    userId: string,
    kind: TaskKind,
    clientRequestId: string,
  ): Promise<InternalTask | undefined> {
    const row = await this.prisma.task.findUnique({
      where: {
        userId_kind_clientRequestId: { userId, kind, clientRequestId },
      },
    });
    return row ? fromRow(row) : undefined;
  }

  async findById(taskId: string): Promise<InternalTask | undefined> {
    const row = await this.prisma.task.findUnique({ where: { id: taskId } });
    return row ? fromRow(row) : undefined;
  }

  async listActive(): Promise<InternalTask[]> {
    const rows = await this.prisma.task.findMany({
      where: { status: { in: ["queued", "running"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows.map(fromRow);
  }

  async update(task: InternalTask): Promise<void> {
    await this.prisma.task.update({
      where: { id: task.taskId },
      data: updateData(task),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
