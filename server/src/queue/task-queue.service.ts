import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, type Job } from "bullmq";
import type { Subscription } from "rxjs";
import { TaskEvents } from "../tasks/task.events";
import { TaskProcessorService } from "../tasks/task-processor.service";
import { TasksService } from "../tasks/tasks.service";

type TaskJob = { taskId: string };

const QUEUE_NAME = "canvas-generation";

@Injectable()
export class TaskQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name);
  private readonly redisUrl: string | undefined;
  private readonly workerDisabled: boolean;
  private readonly concurrency: number;
  private queue: Queue<TaskJob> | null = null;
  private worker: Worker<TaskJob> | null = null;
  private eventsSubscription: Subscription | null = null;

  constructor(
    config: ConfigService,
    private readonly processor: TaskProcessorService,
    private readonly tasks: TasksService,
    private readonly events: TaskEvents,
  ) {
    this.redisUrl = config.get<string>("REDIS_URL")?.trim() || undefined;
    this.workerDisabled = config.get<string>("WORKER_DISABLED") === "true";
    this.concurrency = Math.max(1, Number(config.get<string>("WORKER_CONCURRENCY") ?? 4));
  }

  async onModuleInit(): Promise<void> {
    if (this.redisUrl) {
      this.queue = new Queue<TaskJob>(QUEUE_NAME, {
        connection: { url: this.redisUrl },
      });
      if (!this.workerDisabled) {
        this.worker = new Worker<TaskJob>(
          QUEUE_NAME,
          async (job: Job<TaskJob>) => {
            await this.processor.execute(job.data.taskId);
          },
          {
            connection: { url: this.redisUrl, maxRetriesPerRequest: null },
            concurrency: this.concurrency,
          },
        );
        this.worker.on("failed", (job, error) => {
          this.logger.error(`任务 ${job?.data.taskId ?? "unknown"} 执行失败: ${error.message}`);
        });
      }
    }

    this.eventsSubscription = this.events.created$.subscribe((task) => {
      void this.enqueue(task.taskId);
    });

    const active = await this.tasks.listActive();
    for (const task of active) await this.enqueue(task.taskId);
  }

  async onModuleDestroy(): Promise<void> {
    this.eventsSubscription?.unsubscribe();
    await this.worker?.close();
    await this.queue?.close();
  }

  private async enqueue(taskId: string): Promise<void> {
    if (!this.queue) {
      if (this.workerDisabled) {
        this.logger.warn("未配置 REDIS_URL 且 WORKER_DISABLED=true，任务不会执行");
        return;
      }
      // 没有 Redis 时退化为进程内执行，保证本地开发可用。
      await this.processor.execute(taskId);
      return;
    }
    try {
      await this.queue.add("generate", { taskId }, {
        jobId: taskId,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(
        `任务 ${taskId} 入队失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
