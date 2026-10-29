import { timingSafeEqual } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

export type AdminCredentials = {
  email: string;
  password: string;
};

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminCredentials(config: ConfigService): AdminCredentials | null {
  const email = config.get<string>("ADMIN_EMAIL")?.trim();
  const password = config.get<string>("ADMIN_PASSWORD");
  if (!email || !password) return null;
  return { email, password };
}

export async function setupAdmin(
  fastify: FastifyInstance,
  config: ConfigService,
): Promise<void> {
  const credentials = adminCredentials(config);
  const cookiePassword = config.get<string>("ADMIN_COOKIE_SECRET");
  if (!credentials || !cookiePassword) {
    console.warn("[admin] 未配置 ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_COOKIE_SECRET，管理端未启用");
    return;
  }

  const { default: AdminJS } = await import("adminjs");
  const { default: AdminJSFastify } = await import("@adminjs/fastify");
  const { Database, Resource, getModelByName } = await import("@adminjs/prisma");
  AdminJS.registerAdapter({ Database, Resource });

  const prisma = new PrismaClient();
  const admin = new AdminJS({
    rootPath: "/admin",
    branding: { companyName: "Infinite Canvas", withMadeWithLove: false },
    resources: [
      {
        resource: { model: getModelByName("ModelConfig"), client: prisma },
        options: {
          navigation: { name: "模型" },
          properties: {
            modes: { type: "mixed" },
            limits: { type: "mixed" },
            output: { type: "mixed" },
            params: { type: "mixed" },
            pricing: { type: "mixed" },
          },
        },
      },
      {
        resource: { model: getModelByName("ProviderConfig"), client: prisma },
        options: {
          navigation: { name: "模型" },
          properties: {
            apiKeyEncrypted: { isVisible: false },
            extra: { type: "mixed" },
          },
        },
      },
      {
        resource: { model: getModelByName("Task"), client: prisma },
        options: {
          navigation: { name: "任务" },
          actions: { new: false, edit: false, delete: false, bulkDelete: false },
          properties: {
            request: { type: "mixed", isVisible: { list: false, show: true, edit: false } },
            result: { type: "mixed", isVisible: { list: false, show: true, edit: false } },
            error: { type: "mixed", isVisible: { list: false, show: true, edit: false } },
          },
        },
      },
    ],
  });

  await fastify.register(async (scope) => {
    await AdminJSFastify.buildAuthenticatedRouter(
      admin,
      {
        authenticate: async (email, password) => {
          if (equal(email, credentials.email) && equal(password, credentials.password)) {
            return { email: credentials.email };
          }
          return null;
        },
        cookieName: "canvas_admin",
        cookiePassword,
      },
      scope,
    );
  });

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  console.log("[admin] AdminJS mounted at /admin");
}
