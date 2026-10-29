import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ByokModule } from "./byok/byok.module";
import { AuthGuard } from "./common/auth.guard";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health/health.controller";
import { ModelsModule } from "./models/models.module";
import { TaskQueueModule } from "./queue/task-queue.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { TasksModule } from "./tasks/tasks.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env.local", ".env"],
    }),
    PrismaModule,
    ByokModule,
    ModelsModule,
    UploadsModule,
    TasksModule,
    RealtimeModule,
    TaskQueueModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
