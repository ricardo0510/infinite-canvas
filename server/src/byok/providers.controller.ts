import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import type { AuthUser } from "../common/auth.guard";
import { CredentialsService } from "./credentials.service";
import { CreateCredentialDto, UpdateCredentialDto } from "./dto/byok.dto";
import { ProviderCatalogService } from "./provider-catalog.service";

@Controller("providers")
export class ProvidersController {
  constructor(
    private readonly catalog: ProviderCatalogService,
    private readonly credentials: CredentialsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { providers: await this.catalog.listProviders(user.id) };
  }

  @Get(":providerId/credentials")
  async listCredentials(
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
  ) {
    return { credentials: await this.credentials.list(user.id, providerId) };
  }

  @Post(":providerId/credentials")
  async createCredential(
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.credentials.create(user.id, providerId, dto);
  }

  @Patch(":providerId/credentials/:credentialId")
  async updateCredential(
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Param("credentialId") credentialId: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.credentials.update(user.id, providerId, credentialId, dto);
  }

  @Delete(":providerId/credentials/:credentialId")
  async removeCredential(
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Param("credentialId") credentialId: string,
  ) {
    await this.credentials.remove(user.id, providerId, credentialId);
    return { removed: true };
  }

  @Post(":providerId/credentials/:credentialId/test")
  async testCredential(
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Param("credentialId") credentialId: string,
  ) {
    return this.credentials.test(user.id, providerId, credentialId);
  }

  @Get(":providerId/models")
  async listModels(@Param("providerId") providerId: string) {
    return { models: await this.catalog.listProviderModels(providerId) };
  }

  @Post(":providerId/models/sync")
  async syncModels(@CurrentUser() user: AuthUser, @Param("providerId") providerId: string) {
    return { models: await this.catalog.syncModels(user.id, providerId) };
  }
}
