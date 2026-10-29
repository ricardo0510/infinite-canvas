import { Module } from "@nestjs/common";
import { OpenAICompatibleAdapter } from "../providers/adapters/openai-compatible.adapter";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { SecretCipher } from "../security/secret-cipher";
import { CredentialsService } from "./credentials.service";
import { ProviderCatalogService } from "./provider-catalog.service";
import { ProvidersController } from "./providers.controller";
import { UserModelsController } from "./user-models.controller";

@Module({
  controllers: [ProvidersController, UserModelsController],
  providers: [
    SecretCipher,
    OpenAICompatibleAdapter,
    ProviderRegistry,
    CredentialsService,
    ProviderCatalogService,
  ],
  exports: [SecretCipher, ProviderRegistry, CredentialsService, ProviderCatalogService],
})
export class ByokModule {}
