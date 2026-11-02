import { timingSafeEqual } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { MODEL_KINDS, MODEL_KIND_LABELS } from "../models/model.types";

const KIND_OPTIONS = MODEL_KINDS.map((value) => ({
  value,
  label: MODEL_KIND_LABELS[value],
}));

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
    branding: { companyName: "无限画布 · 管理后台", withMadeWithLove: false },
    locale: {
      language: "zh-CN",
      availableLanguages: ["zh-CN"],
      translations: {
        "zh-CN": {
          labels: {
            ModelConfig: "模型配置",
            ProviderConfig: "Provider 配置",
            ProviderModel: "供应商模型",
            User: "用户",
            UserProviderCredential: "用户凭据",
            UserModelPreference: "用户模型偏好",
            ApiToken: "API Token",
            Task: "任务",
          },
          resources: {
            ModelConfig: {
              properties: {
                id: "ID",
                name: "名称",
                kind: "类型",
                modes: "模式",
                description: "描述",
                logoUrl: "Logo",
                limits: "限制",
                output: "输出能力",
                params: "参数",
                pricing: "价格",
                enabled: "启用",
                sortOrder: "排序",
                createdAt: "创建时间",
                updatedAt: "更新时间",
              },
              actions: {
                new: "新建模型",
                list: "模型列表",
                show: "查看模型",
                edit: "编辑模型",
                delete: "删除模型",
                bulkDelete: "批量删除模型",
              },
            },
            ProviderConfig: {
              properties: {
                id: "ID",
                name: "名称",
                type: "类型",
                baseUrl: "Base URL",
                adapter: "适配器",
                authType: "鉴权方式",
                docsUrl: "文档地址",
                supportsModels: "支持模型同步",
                timeoutMs: "超时（毫秒）",
                extra: "扩展配置",
                enabled: "启用",
                createdAt: "创建时间",
                updatedAt: "更新时间",
              },
              actions: {
                new: "新建 Provider",
                list: "Provider 列表",
                show: "查看 Provider",
                edit: "编辑 Provider",
                delete: "删除 Provider",
                bulkDelete: "批量删除 Provider",
              },
            },
            ProviderModel: {
              properties: {
                id: "ID",
                providerId: "供应商",
                modelId: "模型 ID",
                displayName: "显示名",
                kind: "类型",
                capabilities: "能力",
                source: "来源",
                enabled: "启用",
                lastSyncedAt: "最后同步",
                createdAt: "创建时间",
                updatedAt: "更新时间",
              },
              actions: {
                new: "新建供应商模型",
                list: "供应商模型列表",
                show: "查看供应商模型",
                edit: "编辑供应商模型",
                delete: "删除供应商模型",
                bulkDelete: "批量删除供应商模型",
              },
            },
            Task: {
              properties: {
                id: "任务 ID",
                userId: "用户",
                kind: "类型",
                status: "状态",
                progress: "进度",
                modelId: "模型",
                mode: "模式",
                request: "请求",
                result: "结果",
                error: "错误",
                clientRequestId: "幂等键",
                createdAt: "创建时间",
                updatedAt: "更新时间",
                expiresAt: "过期时间",
              },
              actions: {
                list: "任务列表",
                show: "查看任务",
              },
            },
          },
        },
      },
    },
    resources: [
      {
        resource: { model: getModelByName("ModelConfig"), client: prisma },
        options: {
          navigation: { name: "模型" },
          properties: {
            kind: { availableValues: KIND_OPTIONS },
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
            extra: { type: "mixed" },
          },
        },
      },
      {
        resource: { model: getModelByName("ProviderModel"), client: prisma },
        options: {
          navigation: { name: "模型" },
          properties: {
            kind: { availableValues: KIND_OPTIONS },
            capabilities: { type: "mixed" },
          },
        },
      },
      {
        resource: { model: getModelByName("UserProviderCredential"), client: prisma },
        options: {
          navigation: { name: "用户" },
          actions: {
            new: false,
            edit: false,
            delete: false,
            bulkDelete: false,
          },
          properties: {
            apiKeyEncrypted: { isVisible: false },
            keyMask: { isVisible: { list: true, show: true, edit: false } },
          },
        },
      },
      {
        resource: { model: getModelByName("ApiToken"), client: prisma },
        options: {
          navigation: { name: "用户" },
          actions: { new: false, edit: false, delete: false, bulkDelete: false },
          properties: {
            tokenHash: { isVisible: false },
          },
        },
      },
      {
        resource: { model: getModelByName("User"), client: prisma },
        options: {
          navigation: { name: "用户" },
          actions: { new: false, edit: false, delete: false, bulkDelete: false },
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
