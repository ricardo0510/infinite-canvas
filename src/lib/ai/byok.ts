import { aiRequest } from "./http";
import type { ModelKind } from "./types";

export type ProviderInfo = {
  id: string;
  name: string;
  adapter: string;
  authType: string;
  supportsModels: boolean;
  docsUrl: string | null;
  bound: boolean;
  keyCount: number;
};

export type CredentialInfo = {
  id: string;
  providerId: string;
  label: string;
  keyMask: string;
  status: "active" | "invalid" | "revoked" | string;
  lastVerifiedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderModelInfo = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  kind: ModelKind;
  capabilities: Record<string, unknown> | null;
  source: string;
  enabled: boolean;
  lastSyncedAt: string | null;
};

export type UserModelInfo = {
  providerModelId: string;
  publicId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  kind: ModelKind;
  enabled: boolean;
  isDefault: boolean;
};

export async function listProviders(): Promise<ProviderInfo[]> {
  const data = await aiRequest<{ providers: ProviderInfo[] }>("/providers");
  return data.providers ?? [];
}

export async function listCredentials(providerId: string): Promise<CredentialInfo[]> {
  const data = await aiRequest<{ credentials: CredentialInfo[] }>(
    `/providers/${encodeURIComponent(providerId)}/credentials`,
  );
  return data.credentials ?? [];
}

export async function createCredential(
  providerId: string,
  input: { label?: string; apiKey: string },
): Promise<CredentialInfo> {
  return aiRequest<CredentialInfo>(`/providers/${encodeURIComponent(providerId)}/credentials`, {
    method: "POST",
    body: input,
  });
}

export async function updateCredential(
  providerId: string,
  credentialId: string,
  input: { label?: string; apiKey?: string },
): Promise<CredentialInfo> {
  return aiRequest<CredentialInfo>(
    `/providers/${encodeURIComponent(providerId)}/credentials/${encodeURIComponent(credentialId)}`,
    { method: "PATCH", body: input },
  );
}

export async function deleteCredential(
  providerId: string,
  credentialId: string,
): Promise<void> {
  await aiRequest<{ removed: boolean }>(
    `/providers/${encodeURIComponent(providerId)}/credentials/${encodeURIComponent(credentialId)}`,
    { method: "DELETE" },
  );
}

export async function testCredential(
  providerId: string,
  credentialId: string,
): Promise<CredentialInfo> {
  return aiRequest<CredentialInfo>(
    `/providers/${encodeURIComponent(providerId)}/credentials/${encodeURIComponent(credentialId)}/test`,
    { method: "POST" },
  );
}

export async function listProviderModels(providerId: string): Promise<ProviderModelInfo[]> {
  const data = await aiRequest<{ models: ProviderModelInfo[] }>(
    `/providers/${encodeURIComponent(providerId)}/models`,
  );
  return data.models ?? [];
}

export async function syncProviderModels(providerId: string): Promise<ProviderModelInfo[]> {
  const data = await aiRequest<{ models: ProviderModelInfo[] }>(
    `/providers/${encodeURIComponent(providerId)}/models/sync`,
    { method: "POST" },
  );
  return data.models ?? [];
}

export async function listUserModels(): Promise<UserModelInfo[]> {
  const data = await aiRequest<{ models: UserModelInfo[] }>("/user/models");
  return data.models ?? [];
}

export async function saveUserModels(
  models: { providerModelId: string; enabled: boolean; isDefault: boolean }[],
): Promise<UserModelInfo[]> {
  const data = await aiRequest<{ models: UserModelInfo[] }>("/user/models", {
    method: "PUT",
    body: { models },
  });
  return data.models ?? [];
}
