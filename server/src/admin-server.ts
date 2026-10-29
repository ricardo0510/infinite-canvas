import path from "node:path";
import dotenv from "dotenv";
import Fastify from "fastify";
import { ConfigService } from "@nestjs/config";
import { adminCredentials, setupAdmin } from "./admin/admin";
import { setupQueueBoard } from "./admin/queue-board";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function bootstrap(): Promise<void> {
  const fastify = Fastify({ logger: true });
  const config = new ConfigService(process.env);
  const credentials = adminCredentials(config);

  await setupAdmin(fastify, config);
  await setupQueueBoard(fastify, config, credentials);

  const port = Number(config.get<string>("ADMIN_PORT") ?? 8791);
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`Admin ready at http://localhost:${port}/admin`);
}

void bootstrap();
