import { Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../common/api-exception";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  async upload(@Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) throw new ApiException(20001, "请选择要上传的文件", 422);
    return this.uploads.save(file);
  }
}
