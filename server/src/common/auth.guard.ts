import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { ApiException } from "./api-exception";
import { PUBLIC_KEY } from "./public.decorator";

export type AuthUser = { id: string };
export type AuthenticatedRequest = FastifyRequest & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const expected = this.config.get<string>("API_TOKEN")?.trim();
    if (!expected) {
      request.user = { id: "dev-user" };
      return true;
    }

    const header = request.headers.authorization;
    if (header === `Bearer ${expected}`) {
      request.user = { id: "default-user" };
      return true;
    }

    throw new ApiException(10001, "登录已过期，请重新登录", 401);
  }
}
