import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { ApiResponseInterceptor } from "./common/api-response.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: "info",
        redact: ["req.headers.authorization", "req.body.apiKey", "req.body.apiKeyEncrypted"],
      },
      bodyLimit: 2 * 1024 * 1024,
    }),
  );
  const config = app.get(ConfigService);

  const uploadDir = path.resolve(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads");
  await mkdir(uploadDir, { recursive: true });
  await app.register(multipart, {
    limits: {
      fileSize: Number(config.get<string>("MAX_UPLOAD_BYTES") ?? 20 * 1024 * 1024),
      files: 1,
    },
  });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: "/uploads/",
  });

  const corsOrigins = (config.get<string>("CORS_ORIGINS") ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === "*" ? true : corsOrigins,
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(config.get<string>("PORT") ?? 8790);
  app.enableShutdownHooks();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API ready at http://localhost:${port}/v1`);
}

void bootstrap();
