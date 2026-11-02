import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../database/prisma.service";
import { hashApiToken } from "../security/api-token";
import { ApiException } from "./api-exception";
import { PUBLIC_KEY } from "./public.decorator";

export type AuthUser = { id: string };
export type AuthenticatedRequest = FastifyRequest & { user?: AuthUser };

const DEFAULT_USER_ID = "default-user";
const DEV_USER_ID = "dev-user";
const LAST_USED_THROTTLE_MS = 60_000;

function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  return match?.[1]?.trim() || null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);
    if (token) {
      const user = await this.userForToken(token);
      if (user) {
        request.user = user;
        return true;
      }

      // API_TOKEN 保留为单用户部署的引导令牌；多用户请使用数据库中的个人 token。
      const expected = this.config.get<string>("API_TOKEN")?.trim();
      if (expected && safeEqual(token, expected)) {
        request.user = { id: DEFAULT_USER_ID };
        return true;
      }
      throw new ApiException(10001, "登录已过期，请重新登录", 401);
    }

    const expected = this.config.get<string>("API_TOKEN")?.trim();
    const devAllowAnonymous =
      (this.config.get<string>("DEV_ALLOW_ANONYMOUS") ?? "true").trim().toLowerCase() !==
      "false";
    if (!expected && devAllowAnonymous) {
      request.user = { id: DEV_USER_ID };
      return true;
    }
    throw new ApiException(10001, "缺少访问令牌", 401);
  }

  private async userForToken(token: string): Promise<AuthUser | null> {
    try {
      const row = await this.prisma.apiToken.findUnique({
        where: { tokenHash: hashApiToken(token) },
        select: {
          id: true,
          userId: true,
          revokedAt: true,
          lastUsedAt: true,
          user: { select: { status: true } },
        },
      });
      if (!row || row.revokedAt || row.user.status !== "active") return null;

      if (
        !row.lastUsedAt ||
        Date.now() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
      ) {
        void this.prisma.apiToken
          .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      }
      return { id: row.userId };
    } catch {
      // 数据库不可用时回退到 env 令牌或开发模式，不让鉴权本身崩溃。
      return null;
    }
  }
}
