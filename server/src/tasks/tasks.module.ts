import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { ModelsModule } from "../models/models.module";
import { PrismaTaskRepository } from "./prisma-task.repository";
import { TASK_REPOSITORY, InMemoryTaskRepository } from "./task.repository";
import { TaskEvents } from "./task.events";
import { TaskProcessorService } from "./task-processor.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [ModelsModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskEvents,
    TaskProcessorService,
    {
      provide: TASK_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>("DATABASE_URL");
        if (!databaseUrl) {
          console.warn("[tasks] DATABASE_URL 未配置，使用内存任务仓库（重启后丢失）");
          return new InMemoryTaskRepository();
        }
        return new PrismaTaskRepository(
          new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
        );
      },
    },
  ],
  exports: [TasksService, TaskEvents, TaskProcessorService],
})
export class TasksModule {}
