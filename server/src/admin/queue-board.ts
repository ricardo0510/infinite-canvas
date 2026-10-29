import { timingSafeEqual } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import type { AdminCredentials } from "./admin";

function authorized(request: FastifyRequest, credentials: AdminCredentials): boolean {
  const header = request.headers.authorization ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const email = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const a = Buffer.from(`${email}:${password}`);
  const b = Buffer.from(`${credentials.email}:${credentials.password}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setupQueueBoard(
  fastify: FastifyInstance,
  config: ConfigService,
  credentials: AdminCredentials | null,
): Promise<void> {
  const redisUrl = config.get<string>("REDIS_URL")?.trim();
  if (!redisUrl || !credentials) {
    console.warn("[admin] 未配置 REDIS_URL 或管理员账号，Bull Board 未启用");
    return;
  }

  const queue = new Queue("canvas-generation", { connection: { url: redisUrl } });
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });

  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/admin/queues")) return;
    if (authorized(request, credentials)) return;
    reply
      .code(401)
      .header("WWW-Authenticate", 'Basic realm="Infinite Canvas Admin"')
      .send("Unauthorized");
  });

  await fastify.register(serverAdapter.registerPlugin(), { prefix: "/admin/queues" });
  fastify.addHook("onClose", async () => {
    await queue.close();
  });
  console.log("[admin] Bull Board mounted at /admin/queues");
}
