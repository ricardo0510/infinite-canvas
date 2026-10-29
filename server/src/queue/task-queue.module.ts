import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import { TaskQueueService } from "./task-queue.service";

@Module({
  imports: [TasksModule],
  providers: [TaskQueueService],
})
export class TaskQueueModule {}
