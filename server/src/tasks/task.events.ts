import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { Subject } from "rxjs";
import type { InternalTask } from "./task.types";

const EVENTS_CHANNEL = "canvas:task-events";

type TaskEventType = "created" | "updated";

type TaskEventMessage = {
  source: string;
  type: TaskEventType;
  task: InternalTask;
};

/**
 * 任务事件总线。本地用 RxJS 通知同进程订阅者，同时通过 Redis 广播，
 * 让拆分出去的 Worker 进程也能把进度和结果推给 API 进程的 WebSocket 网关。
 */
@Injectable()
export class TaskEvents implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskEvents.name);
  private readonly instanceId = randomUUID();
  private readonly createdSource = new Subject<InternalTask>();
  private readonly updatedSource = new Subject<InternalTask>();
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  readonly created$ = this.createdSource.asObservable();
  readonly updated$ = this.updatedSource.asObservable();

  onModuleInit(): void {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) return;

    this.publisher = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.publisher.on("error", (error) => {
      this.logger.warn(`任务事件发布失败: ${error.message}`);
    });
    this.subscriber.on("error", (error) => {
      this.logger.warn(`任务事件订阅失败: ${error.message}`);
    });
    this.subscriber.on("message", (channel, payload) => {
      if (channel !== EVENTS_CHANNEL) return;
      this.receive(payload);
    });
    this.subscriber
      .subscribe(EVENTS_CHANNEL)
      .catch((error: unknown) =>
        this.logger.warn(
          `任务事件订阅失败: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
    this.publisher = null;
    this.subscriber = null;
  }

  emitCreated(task: InternalTask): void {
    this.createdSource.next(task);
    this.publish("created", task);
  }

  emitUpdated(task: InternalTask): void {
    this.updatedSource.next(task);
    this.publish("updated", task);
  }

  private publish(type: TaskEventType, task: InternalTask): void {
    if (!this.publisher) return;
    const message: TaskEventMessage = { source: this.instanceId, type, task };
    this.publisher.publish(EVENTS_CHANNEL, JSON.stringify(message)).catch((error: unknown) => {
      this.logger.warn(
        `任务事件发布失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private receive(payload: string): void {
    let message: TaskEventMessage;
    try {
      message = JSON.parse(payload) as TaskEventMessage;
    } catch {
      return;
    }
    if (!message || message.source === this.instanceId) return;
    if (!message.task || (message.type !== "created" && message.type !== "updated")) return;
    if (message.type === "created") this.createdSource.next(message.task);
    else this.updatedSource.next(message.task);
  }
}
