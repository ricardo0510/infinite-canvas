import { Module } from "@nestjs/common";
import { ModelsModule } from "../models/models.module";
import { TaskEvents } from "./task.events";
import { TaskRunner } from "./task-runner.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [ModelsModule],
  controllers: [TasksController],
  providers: [TasksService, TaskEvents, TaskRunner],
  exports: [TasksService, TaskEvents],
})
export class TasksModule {}
