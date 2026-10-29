import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiException } from "./api-exception";

function codeForStatus(status: number): number {
  switch (status) {
    case 401:
      return 10001;
    case 403:
      return 10003;
    case 404:
      return 10004;
    case 409:
      return 20005;
    case 422:
      return 20001;
    case 429:
      return 10005;
    case 503:
      return 20004;
    default:
      return status >= 500 ? 50000 : 20001;
  }
}

function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === "string") return response;
  if (typeof response === "object" && response !== null) {
    const message = (response as Record<string, unknown>).message;
    if (Array.isArray(message)) return message.join("；");
    if (typeof message === "string") return message;
  }
  return exception.message;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    if (request.id) reply.header("X-Request-Id", request.id);

    if (exception instanceof ApiException) {
      reply.status(exception.status).send({
        code: exception.code,
        message: exception.message,
        data: exception.data,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      reply.status(status).send({
        code: codeForStatus(status),
        message: messageOf(exception),
        data: null,
      });
      return;
    }

    console.error(exception);
    reply.status(500).send({
      code: 50000,
      message: "服务端内部错误",
      data: null,
    });
  }
}
