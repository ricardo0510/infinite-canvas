import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { AuthUser } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { CreateGenerationDto } from "./dto/create-generation.dto";
import { TasksService } from "./tasks.service";
import type { TaskKind } from "./task.types";

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post("text/generations")
  async createText(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGenerationDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.create(user, "text", dto, reply);
  }

  @Post("image/generations")
  async createImage(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGenerationDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.create(user, "image", dto, reply);
  }

  @Post("video/generations")
  async createVideo(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGenerationDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.create(user, "video", dto, reply);
  }

  @Get("tasks/:taskId")
  async getTask(@CurrentUser() user: AuthUser, @Param("taskId") taskId: string) {
    return this.tasks.get(user.id, taskId);
  }

  @Post("tasks/:taskId/cancel")
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthUser, @Param("taskId") taskId: string) {
    return this.tasks.cancel(user.id, taskId);
  }

  private async create(
    user: AuthUser,
    kind: TaskKind,
    dto: CreateGenerationDto,
    reply: FastifyReply,
  ) {
    const { task, created } = await this.tasks.create(user.id, kind, dto);
    reply.code(created ? 202 : 200);
    return {
      taskId: task.taskId,
      status: task.status,
      createdAt: task.createdAt,
    };
  }
}
