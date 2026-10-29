import { Controller, Post, Req } from "@nestjs/common";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../common/api-exception";
import { UploadsService } from "./uploads.service";

type MultipartBody = { file?: MultipartFile };

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  async upload(@Req() request: FastifyRequest) {
    // AdminJS 会全局注册 attachFieldsToBody，此时文件在 request.body.file；
    // 未启用管理端时走常规 request.file()。
    const fromBody = (request.body as MultipartBody | undefined)?.file;
    const file = fromBody ?? (await request.file().catch(() => undefined));
    if (!file) throw new ApiException(20001, "请选择要上传的文件", 422);
    return this.uploads.save(file);
  }
}
