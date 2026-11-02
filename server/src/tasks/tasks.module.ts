import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ByokModule } from "../byok/byok.module";
import { PrismaService } from "../database/prisma.service";
import { ModelsModule } from "../models/models.module";
import { PrismaTaskRepository } from "./prisma-task.repository";
import { TASK_REPOSITORY, InMemoryTaskRepository } from "./task.repository";
import { TaskEvents } from "./task.events";
import { TaskProcessorService } from "./task-processor.service";
import { DeepSeekTextProvider } from "../providers/deepseek-text.provider";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [ModelsModule, ByokModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskEvents,
    TaskProcessorService,
    DeepSeekTextProvider,
    {
      provide: TASK_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        if (!config.get<string>("DATABASE_URL")) {
          console.warn("[tasks] DATABASE_URL 未配置，使用内存任务仓库（重启后丢失）");
          return new InMemoryTaskRepository();
        }
        return new PrismaTaskRepository(prisma);
      },
    },
  ],
  exports: [TasksService, TaskEvents, TaskProcessorService],
})
export class TasksModule {}
