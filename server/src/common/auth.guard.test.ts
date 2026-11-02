import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { PrismaService } from "../database/prisma.service";
import { hashApiToken } from "../security/api-token";
import { ApiException } from "./api-exception";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard";

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function fakePrisma(
  row: unknown,
  update: () => Promise<unknown> = async () => undefined,
): PrismaService {
  return {
    apiToken: {
      findUnique: async () => row,
      update,
    },
  } as unknown as PrismaService;
}

function createGuard(options: {
  row?: unknown;
  env?: Record<string, string | undefined>;
  update?: () => Promise<unknown>;
}): AuthGuard {
  const config = {
    get: (key: string) => options.env?.[key],
  } as unknown as ConfigService;
  const reflector = {
    getAllAndOverride: () => false,
  } as unknown as Reflector;
  return new AuthGuard(reflector, config, fakePrisma(options.row, options.update));
}

const ACTIVE_ROW = {
  id: "token-1",
  userId: "user-1",
  revokedAt: null,
  lastUsedAt: null,
  user: { status: "active" },
};

describe("AuthGuard", () => {
  it("accepts a database token and records its use", async () => {
    let updated = false;
    const guard = createGuard({
      row: ACTIVE_ROW,
      update: async () => {
        updated = true;
        return undefined;
      },
    });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${hashApiToken("ignored")}` },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: "user-1" });
    expect(updated).toBe(true);
  });

  it("rejects a revoked token", async () => {
    const guard = createGuard({
      row: { ...ACTIVE_ROW, revokedAt: new Date() },
      env: { API_TOKEN: "env-token" },
    });

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: "Bearer something-else" } }),
      ),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("rejects a token whose user is disabled", async () => {
    const guard = createGuard({
      row: { ...ACTIVE_ROW, user: { status: "disabled" } },
      env: { API_TOKEN: "env-token" },
    });

    await expect(
      guard.canActivate(contextFor({ headers: { authorization: "Bearer nope" } })),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("keeps the configured API_TOKEN working as the bootstrap user", async () => {
    const guard = createGuard({ row: null, env: { API_TOKEN: "env-token" } });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: "Bearer env-token" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: "default-user" });
  });

  it("allows anonymous dev requests only when no API_TOKEN is configured", async () => {
    const devGuard = createGuard({ row: null, env: { DEV_ALLOW_ANONYMOUS: "true" } });
    const request: Partial<AuthenticatedRequest> = { headers: {} };
    await expect(devGuard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: "dev-user" });

    const strictGuard = createGuard({ row: null, env: { DEV_ALLOW_ANONYMOUS: "false" } });
    await expect(strictGuard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      ApiException,
    );
  });
});
