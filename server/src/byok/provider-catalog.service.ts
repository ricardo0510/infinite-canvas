import { Injectable } from "@nestjs/common";
import type { ProviderConfig, ProviderModel } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../database/prisma.service";
import type { AiModel, ModelKind } from "../models/model.types";
import { UpstreamAuthError } from "../providers/provider-adapter";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { CredentialsService } from "./credentials.service";

export type PublicProvider = {
  id: string;
  name: string;
  adapter: string;
  authType: string;
  supportsModels: boolean;
  docsUrl: string | null;
  bound: boolean;
  keyCount: number;
};

export type PublicProviderModel = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  kind: string;
  capabilities: Record<string, unknown> | null;
  source: string;
  enabled: boolean;
  lastSyncedAt: string | null;
};

export type PublicUserModel = {
  providerModelId: string;
  publicId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  kind: ModelKind;
  enabled: boolean;
  isDefault: boolean;
};

export type ResolvedUserModel = {
  model: AiModel;
  providerId: string;
  providerModel: string;
  credentialId: string;
};

export type UserModelInput = {
  providerModelId: string;
  enabled?: boolean;
  isDefault?: boolean;
};

function toPublicModel(row: ProviderModel): PublicProviderModel {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    displayName: row.displayName,
    kind: row.kind,
    capabilities:
      row.capabilities && typeof row.capabilities === "object" && !Array.isArray(row.capabilities)
        ? (row.capabilities as Record<string, unknown>)
        : null,
    source: row.source,
    enabled: row.enabled,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

export function publicModelId(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function toAiModel(row: ProviderModel & { provider: ProviderConfig }): AiModel {
  return {
    id: publicModelId(row.providerId, row.modelId),
    name: row.displayName || row.modelId,
    kind: row.kind as ModelKind,
    modes: [],
    description: `${row.provider.name} · 使用你的 API Key`,
    limits: { maxPromptLength: 60_000, maxImages: 0, maxVideos: 0 },
    output: { image: null, video: null },
  };
}

@Injectable()
export class ProviderCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly credentials: CredentialsService,
  ) {}

  async listProviders(userId: string): Promise<PublicProvider[]> {
    const providers = await this.prisma.providerConfig.findMany({
      where: { enabled: true, supportsModels: true },
      orderBy: { name: "asc" },
    });
    const credentials = await this.prisma.userProviderCredential.findMany({
      where: { userId, status: "active" },
      select: { providerId: true },
    });
    const counts = new Map<string, number>();
    for (const credential of credentials) {
      counts.set(credential.providerId, (counts.get(credential.providerId) ?? 0) + 1);
    }
    return providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      adapter: provider.adapter,
      authType: provider.authType,
      supportsModels: provider.supportsModels,
      docsUrl: provider.docsUrl,
      bound: counts.has(provider.id),
      keyCount: counts.get(provider.id) ?? 0,
    }));
  }

  async listProviderModels(providerId: string): Promise<PublicProviderModel[]> {
    const provider = await this.prisma.providerConfig.findUnique({ where: { id: providerId } });
    if (!provider) throw new ApiException(10004, "供应商不存在", 404);
    const rows = await this.prisma.providerModel.findMany({
      where: { providerId },
      orderBy: [{ kind: "asc" }, { displayName: "asc" }],
    });
    return rows.map(toPublicModel);
  }

  async syncModels(userId: string, providerId: string): Promise<PublicProviderModel[]> {
    const { provider, credentialId, ctx } = await this.credentials.contextFor(userId, providerId);
    if (!provider.supportsModels) {
      throw new ApiException(20001, "该供应商不支持自动获取模型列表", 422);
    }

    let models;
    try {
      models = await this.registry.get(provider.adapter).listModels(ctx);
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.credentials.markInvalid(credentialId);
        throw new ApiException(30001, "API Key 已失效，请重新绑定", 400);
      }
      throw new ApiException(
        30001,
        error instanceof Error ? error.message : "模型列表获取失败",
        400,
      );
    }

    const now = new Date();
    for (const model of models) {
      await this.prisma.providerModel.upsert({
        where: { providerId_modelId: { providerId, modelId: model.modelId } },
        update: { displayName: model.displayName, lastSyncedAt: now },
        create: {
          providerId,
          modelId: model.modelId,
          displayName: model.displayName,
          kind: model.kind,
          capabilities: (model.capabilities ?? {}) as Prisma.InputJsonValue,
          source: "sync",
          enabled: false,
          lastSyncedAt: now,
        },
      });
    }
    await this.credentials.touch(credentialId);
    return this.listProviderModels(providerId);
  }

  async listUserModels(userId: string, kind?: ModelKind): Promise<PublicUserModel[]> {
    const rows = await this.prisma.userModelPreference.findMany({
      where: { userId, ...(kind ? { providerModel: { kind } } : {}) },
      include: { providerModel: { include: { provider: true } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => this.toPublicUserModel(row.providerModel, row.enabled, row.isDefault));
  }

  async listUserAiModels(userId: string, kind?: ModelKind): Promise<AiModel[]> {
    const rows = await this.boundModels(userId, kind);
    return rows.map((row) => toAiModel(row));
  }

  private async boundModels(
    userId: string,
    kind?: ModelKind,
  ): Promise<(ProviderModel & { provider: ProviderConfig })[]> {
    const credentials = await this.prisma.userProviderCredential.findMany({
      where: { userId, status: "active" },
      select: { providerId: true },
    });
    const providerIds = [...new Set(credentials.map((credential) => credential.providerId))];
    if (providerIds.length === 0) return [];

    const preferenceCount = await this.prisma.userModelPreference.count({ where: { userId } });
    const rows = await this.prisma.providerModel.findMany({
      where: {
        providerId: { in: providerIds },
        enabled: true,
        provider: { enabled: true },
        ...(kind ? { kind } : {}),
      },
      include: { provider: true, preferences: { where: { userId } } },
      orderBy: [{ displayName: "asc" }],
    });

    return rows
      .filter((row) => {
        if (preferenceCount === 0) return row.enabled;
        return row.preferences[0]?.enabled ?? false;
      })
      .sort((left, right) => {
        const leftDefault = left.preferences[0]?.isDefault ? 1 : 0;
        const rightDefault = right.preferences[0]?.isDefault ? 1 : 0;
        if (leftDefault !== rightDefault) return rightDefault - leftDefault;
        return left.displayName.localeCompare(right.displayName);
      });
  }

  async resolveGenerationModel(
    userId: string,
    modelId: string,
    kind: ModelKind,
  ): Promise<ResolvedUserModel> {
    const credentials = await this.prisma.userProviderCredential.findMany({
      where: { userId, status: "active" },
      select: { id: true, providerId: true },
      orderBy: { createdAt: "asc" },
    });
    if (credentials.length === 0) {
      throw new ApiException(10004, "模型不存在或未绑定 API Key", 404);
    }
    const credentialByProvider = new Map<string, string>();
    for (const credential of credentials) {
      if (!credentialByProvider.has(credential.providerId)) {
        credentialByProvider.set(credential.providerId, credential.id);
      }
    }

    const candidates = await this.candidates(modelId, kind);
    const matched = candidates.filter(
      (row) => row.enabled && row.provider.enabled && credentialByProvider.has(row.providerId),
    );
    if (matched.length === 0) {
      throw new ApiException(10004, "模型不存在或未开通", 404);
    }
    if (matched.length > 1) {
      throw new ApiException(20001, `模型 ${modelId} 不唯一，请改用「供应商:模型」形式`, 422);
    }

    const row = matched[0];
    return {
      model: toAiModel(row),
      providerId: row.providerId,
      providerModel: row.modelId,
      credentialId: credentialByProvider.get(row.providerId)!,
    };
  }

  async getPreferences(userId: string): Promise<PublicUserModel[]> {
    return this.listUserModels(userId);
  }

  async putPreferences(userId: string, items: UserModelInput[]): Promise<PublicUserModel[]> {
    await this.credentials.ensureUser(userId);

    const ids = items.map((item) => item.providerModelId);
    if (new Set(ids).size !== ids.length) {
      throw new ApiException(20001, "模型列表包含重复项", 422);
    }

    const rows = await this.prisma.providerModel.findMany({
      where: { id: { in: ids } },
      include: { provider: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    const credentials = await this.prisma.userProviderCredential.findMany({
      where: { userId, status: "active" },
      select: { providerId: true },
    });
    const bound = new Set(credentials.map((credential) => credential.providerId));

    const defaults = new Map<string, number>();
    for (const item of items) {
      const row = byId.get(item.providerModelId);
      if (!row) throw new ApiException(10004, `模型 ${item.providerModelId} 不存在`, 404);
      if (!row.enabled || !row.provider.enabled) {
        throw new ApiException(20001, `模型 ${row.displayName} 未开通`, 422);
      }
      if (!bound.has(row.providerId)) {
        throw new ApiException(20003, `请先为 ${row.provider.name} 绑定 API Key`, 400);
      }
      if (item.isDefault) {
        defaults.set(row.kind, (defaults.get(row.kind) ?? 0) + 1);
      }
    }
    for (const [kind, count] of defaults) {
      if (count > 1) throw new ApiException(20001, `每种类型只能有一个默认模型（${kind}）`, 422);
    }

    await this.prisma.$transaction([
      this.prisma.userModelPreference.deleteMany({
        where: { userId, ...(ids.length > 0 ? { providerModelId: { notIn: ids } } : {}) },
      }),
      ...items.map((item) =>
        this.prisma.userModelPreference.upsert({
          where: {
            userId_providerModelId: { userId, providerModelId: item.providerModelId },
          },
          update: {
            enabled: item.isDefault ? true : (item.enabled ?? true),
            isDefault: item.isDefault ?? false,
          },
          create: {
            userId,
            providerModelId: item.providerModelId,
            enabled: item.isDefault ? true : (item.enabled ?? true),
            isDefault: item.isDefault ?? false,
          },
        }),
      ),
    ]);

    return this.getPreferences(userId);
  }

  private async candidates(
    modelId: string,
    kind: ModelKind,
  ): Promise<(ProviderModel & { provider: ProviderConfig })[]> {
    const include = { provider: true } as const;
    const byId = await this.prisma.providerModel.findUnique({
      where: { id: modelId },
      include,
    });
    if (byId) return [byId];

    const separator = modelId.indexOf(":");
    if (separator > 0) {
      const providerId = modelId.slice(0, separator);
      const upstreamId = modelId.slice(separator + 1);
      const row = await this.prisma.providerModel.findUnique({
        where: { providerId_modelId: { providerId, modelId: upstreamId } },
        include,
      });
      if (row) return [row];
    }

    return this.prisma.providerModel.findMany({
      where: { modelId, kind },
      include,
    });
  }

  private toPublicUserModel(
    row: ProviderModel & { provider: ProviderConfig },
    enabled: boolean,
    isDefault: boolean,
  ): PublicUserModel {
    return {
      providerModelId: row.id,
      publicId: publicModelId(row.providerId, row.modelId),
      providerId: row.providerId,
      providerName: row.provider.name,
      modelId: row.modelId,
      displayName: row.displayName,
      kind: row.kind as ModelKind,
      enabled,
      isDefault,
    };
  }
}
