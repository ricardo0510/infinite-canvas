import { Injectable } from "@nestjs/common";
import { ProviderCatalogService } from "../byok/provider-catalog.service";
import { CredentialsService } from "../byok/credentials.service";
import { ApiException } from "../common/api-exception";
import type { ProviderContext } from "../providers/provider-adapter";
import { UpstreamAuthError } from "../providers/provider-adapter";
import { ProviderRegistry } from "../providers/provider-registry.service";
import { AGENT_SYSTEM_PROMPT, buildAgentUserPrompt, parseAgentOutput, type AgentResponse } from "./agent.prompt";
import type { AgentChatDto } from "./dto/agent-chat.dto";

const AGENT_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 1600;

@Injectable()
export class AgentService {
  constructor(
    private readonly catalog: ProviderCatalogService,
    private readonly credentials: CredentialsService,
    private readonly registry: ProviderRegistry,
  ) {}

  async chat(userId: string, dto: AgentChatDto): Promise<AgentResponse> {
    const resolved = await this.catalog.resolveGenerationModel(userId, dto.modelId, "text");
    const credential = await this.credentials.resolve(resolved.credentialId);
    const adapter = this.registry.get(credential.provider.adapter);
    if (!adapter.generateText) {
      throw new ApiException(20001, "该模型不支持文本对话", 422);
    }

    const provider = credential.provider;
    const extra =
      provider.extra && typeof provider.extra === "object" && !Array.isArray(provider.extra)
        ? (provider.extra as Record<string, unknown>)
        : undefined;
    const ctx: ProviderContext = {
      baseUrl: provider.baseUrl,
      apiKey: credential.apiKey,
      authType: provider.authType,
      timeoutMs: Math.max(provider.timeoutMs, AGENT_TIMEOUT_MS),
      ...(extra ? { extra } : {}),
    };

    try {
      const output = await adapter.generateText(ctx, {
        model: resolved.providerModel,
        prompt: buildAgentUserPrompt(dto),
        systemPrompt: AGENT_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      await this.credentials.touch(resolved.credentialId);
      return parseAgentOutput(output.text);
    } catch (error) {
      if (error instanceof UpstreamAuthError) {
        await this.credentials.markInvalid(resolved.credentialId);
        throw new ApiException(30001, "API Key 已失效，请重新绑定", 400);
      }
      if (error instanceof ApiException) throw error;
      throw new ApiException(
        30001,
        error instanceof Error ? error.message : "Agent 请求失败",
        400,
      );
    }
  }
}
