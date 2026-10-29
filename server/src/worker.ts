import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // Worker 进程需要显式启用 worker，避免复用 API 进程的 WORKER_DISABLED 配置。
  process.env.WORKER_DISABLED = "false";
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  console.log("Task worker started");
}

void bootstrap();
