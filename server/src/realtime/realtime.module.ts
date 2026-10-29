import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [TasksModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeGateway],
})
export class RealtimeModule {}
