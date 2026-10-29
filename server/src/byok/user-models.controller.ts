import { Body, Controller, Get, Put } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "../common/auth.guard";
import { PutUserModelsDto } from "./dto/byok.dto";
import { ProviderCatalogService } from "./provider-catalog.service";

@Controller("user/models")
export class UserModelsController {
  constructor(private readonly catalog: ProviderCatalogService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { models: await this.catalog.getPreferences(user.id) };
  }

  @Put()
  async put(@CurrentUser() user: AuthUser, @Body() dto: PutUserModelsDto) {
    return { models: await this.catalog.putPreferences(user.id, dto.models) };
  }
}
