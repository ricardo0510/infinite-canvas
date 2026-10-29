import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { Prisma, type ProviderConfig, type UserProviderCredential } from "@prisma/client";
import { ApiException } from "../common/api-exception";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { UpstreamAuthError, type ProviderContext } from "../providers/provider-adapter";
import { SecretCipher, credentialAad, type EncryptedSecret } from "../security/secret-cipher";

export type PublicCredential = {
  id: string;
  providerId: string;
  label: string;
  keyMask: string;
  status: string;
  lastVerifiedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedCredential = {
  credentialId: string;
  apiKey: string;
  provider: ProviderConfig;
};

const ACTIVE_TASK_STATUSES = ["queued", "running"];

function toPublic(row: UserProviderCredential): PublicCredential {
  return {
    id: row.id,
    providerId: row.providerId,
    label: row.label,
    keyMask: row.keyMask,
    status: row.status,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
    private readonly registry: ProviderRegistry,
  ) {}

  async ensureUser(userId: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: "默认用户" },
    });
  }

  async list(userId: string, providerId?: string): Promise<PublicCredential[]> {
    const rows = await this.prisma.userProviderCredential.findMany({
      where: { userId, ...(providerId ? { providerId } : {}) },
      orderBy: [{ providerId: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toPublic);
  }

  async create(
    userId: string,
    providerId: string,
    input: { label?: string; apiKey: string },
  ): Promise<PublicCredential> {
    const apiKey = input.apiKey.trim();
    if (!apiKey) throw new ApiException(20001, "apiKey 不能为空", 422);

    const provider = await this.requireProvider(providerId);
    await this.ensureUser(userId);

    const credentialId = randomUUID();
    const label = input.label?.trim() || "默认";
    const aad = credentialAad(userId, provider.id, credentialId);
    const encrypted = this.cipher.encrypt(apiKey, aad);

    try {
      const row = await this.prisma.userProviderCredential.create({
        data: {
          id: credentialId,
          userId,
          providerId: provider.id,
          label,
          apiKeyEncrypted: this.cipher.serialize(encrypted),
          keyVersion: encrypted.keyVersion,
          keyMask: this.cipher.mask(apiKey),
        },
      });
      return toPublic(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiException(20005, `已存在备注为「${label}」的 Key`, 409);
      }
      throw error;
    }
  }

  async update(
    userId: string,
    providerId: string,
    credentialId: string,
    input: { label?: string; apiKey?: string },
  ): Promise<PublicCredential> {
    const row = await this.requireOwned(userId, providerId, credentialId);
    const data: Prisma.UserProviderCredentialUpdateInput = {};

    if (input.label !== undefined) {
      const label = input.label.trim();
      if (!label) throw new ApiException(20001, "label 不能为空", 422);
      data.label = label;
    }

    const apiKey = input.apiKey?.trim();
    if (apiKey) {
      const aad = credentialAad(row.userId, row.providerId, row.id);
      const encrypted: EncryptedSecret = this.cipher.encrypt(apiKey, aad);
      data.apiKeyEncrypted = this.cipher.serialize(encrypted);
      data.keyVersion = encrypted.keyVersion;
      data.keyMask = this.cipher.mask(apiKey);
      data.status = "active";
      data.lastVerifiedAt = null;
    }

    try {
      const updated = await this.prisma.userProviderCredential.update({
        where: { id: row.id },
        data,
      });
      return toPublic(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiException(20005, "该备注已存在", 409);
      }
      throw error;
    }
  }

  async remove(userId: string, providerId: string, credentialId: string): Promise<void> {
    const row = await this.requireOwned(userId, providerId, credentialId);
    const active = await this.prisma.task.count({
      where: { credentialId: row.id, status: { in: ACTIVE_TASK_STATUSES } },
    });
    if (active > 0) {
      throw new ApiException(20005, "该 Key 仍有进行中的任务，请等待结束或先取消任务", 409);
    }
    await this.prisma.userProviderCredential.update({
      where: { id: row.id },
      data: {
        status: "revoked",
        // 释放 label，保留历史记录的同时允许用户用同名备注重新绑定
        label: `${row.label} · revoked-${row.id.slice(0, 8)}`,
      },
    });
  }

  async test(
    userId: string,
    providerId: string,
    credentialId: string,
  ): Promise<PublicCredential> {
    const row = await this.requireOwned(userId, providerId, credentialId);
    if (row.status === "revoked") {
      throw new ApiException(20005, "该凭据已删除", 409);
    }

    const apiKey = this.decryptRow(row);
    const provider = await this.requireProvider(row.providerId);
    const adapter = this.registry.get(provider.adapter);

    try {
      const result = await adapter.testKey(this.context(provider, apiKey));
      if (!result.ok) {
        throw new ApiException(30001, result.message ?? "Key 校验失败", 400);
      }
      const updated = await this.prisma.userProviderCredential.update({
        where: { id: row.id },
        data: { status: "active", lastVerifiedAt: new Date() },
      });
      return toPublic(updated);
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.markInvalid(row.id);
        throw new ApiException(30001, "API Key 无效或已失效，请重新绑定", 400);
      }
      if (error instanceof ApiException) throw error;
      this.logger.warn(`Key 校验失败（credentialId=${row.id}）`);
      throw new ApiException(
        30001,
        error instanceof Error ? error.message : "Key 校验失败",
        400,
      );
    }
  }

  async getActive(userId: string, providerId: string): Promise<UserProviderCredential> {
    const row = await this.prisma.userProviderCredential.findFirst({
      where: { userId, providerId, status: "active" },
      orderBy: { createdAt: "asc" },
    });
    if (!row) {
      throw new ApiException(20003, "请先绑定该供应商的 API Key", 400);
    }
    return row;
  }

  async resolve(credentialId: string): Promise<ResolvedCredential> {
    const row = await this.prisma.userProviderCredential.findUnique({
      where: { id: credentialId },
      include: { provider: true },
    });
    if (!row || row.status !== "active") {
      throw new ApiException(30001, "API Key 已失效，请重新绑定", 400);
    }
    return {
      credentialId: row.id,
      apiKey: this.decryptRow(row),
      provider: row.provider,
    };
  }

  async contextFor(
    userId: string,
    providerId: string,
  ): Promise<{ provider: ProviderConfig; credentialId: string; ctx: ProviderContext }> {
    const provider = await this.requireProvider(providerId);
    const credential = await this.getActive(userId, providerId);
    const apiKey = this.decryptRow(credential);
    return {
      provider,
      credentialId: credential.id,
      ctx: this.context(provider, apiKey),
    };
  }

  async markInvalid(credentialId: string): Promise<void> {
    await this.prisma.userProviderCredential
      .update({ where: { id: credentialId }, data: { status: "invalid" } })
      .catch(() => undefined);
  }

  async touch(credentialId: string): Promise<void> {
    await this.prisma.userProviderCredential
      .update({ where: { id: credentialId }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  decryptRow(row: UserProviderCredential): string {
    const aad = credentialAad(row.userId, row.providerId, row.id);
    return this.cipher.decrypt(this.cipher.parse(row.apiKeyEncrypted), aad);
  }

  private context(provider: ProviderConfig, apiKey: string): ProviderContext {
    return {
      baseUrl: provider.baseUrl,
      apiKey,
      authType: provider.authType,
      timeoutMs: provider.timeoutMs,
      ...(provider.extra && typeof provider.extra === "object" && !Array.isArray(provider.extra)
        ? { extra: provider.extra as Record<string, unknown> }
        : {}),
    };
  }

  private async requireProvider(providerId: string): Promise<ProviderConfig> {
    const provider = await this.prisma.providerConfig.findUnique({ where: { id: providerId } });
    if (!provider || !provider.enabled) {
      throw new ApiException(10004, "供应商不存在或未启用", 404);
    }
    return provider;
  }

  private async requireOwned(
    userId: string,
    providerId: string,
    credentialId: string,
  ): Promise<UserProviderCredential> {
    const row = await this.prisma.userProviderCredential.findFirst({
      where: { id: credentialId, userId, providerId },
    });
    if (!row) throw new ApiException(10004, "凭据不存在", 404);
    return row;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}
