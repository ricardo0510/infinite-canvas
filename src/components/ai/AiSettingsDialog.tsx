import { useCallback, useEffect, useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { useToastStore } from "../../store/toastStore";
import { getAiApiBase, getAiRealtimeBase, isAiMock, setAiRuntimeConfig } from "../../lib/ai/config";
import { getAiToken } from "../../lib/ai/auth";
import {
  createCredential,
  deleteCredential,
  listCredentials,
  listProviderModels,
  listProviders,
  listUserModels,
  saveUserModels,
  syncProviderModels,
  testCredential,
  updateCredential,
  type CredentialInfo,
  type ProviderInfo,
  type ProviderModelInfo,
} from "../../lib/ai/byok";
import { clearModelCache } from "../../lib/ai/models";
import { Button } from "../ui/Button";
import { Input } from "../ui/Control";
import { DialogHeader } from "../ui/DialogHeader";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";

type ModelPref = { enabled: boolean; isDefault: boolean };
type PrefState = Record<string, ModelPref>;

type Binding = {
  providerId: string;
  credential?: CredentialInfo;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

function statusLabel(status: string): string {
  if (status === "active") return "可用";
  if (status === "invalid") return "已失效";
  if (status === "revoked") return "已删除";
  return status;
}

function prefsFromUserModels(
  models: { providerModelId: string; enabled: boolean; isDefault: boolean }[],
): PrefState {
  const next: PrefState = {};
  for (const model of models) {
    next[model.providerModelId] = { enabled: model.enabled, isDefault: model.isDefault };
  }
  return next;
}

function AiSettingsForm({ onClose }: { onClose: () => void }) {
  const pushToast = useToastStore((state) => state.push);
  const [apiBase, setApiBase] = useState(() => getAiApiBase());
  const [realtimeBase, setRealtimeBase] = useState(() => getAiRealtimeBase());
  const [token, setToken] = useState(() => getAiToken() ?? "");

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [credentials, setCredentials] = useState<Record<string, CredentialInfo[]>>({});
  const [models, setModels] = useState<Record<string, ProviderModelInfo[]>>({});
  const [prefs, setPrefs] = useState<PrefState>({});
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [binding, setBinding] = useState<Binding | null>(null);
  const [bindLabel, setBindLabel] = useState("默认");
  const [bindKey, setBindKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyRuntime = useCallback(() => {
    setAiRuntimeConfig({ apiBase, realtimeBase, token });
  }, [apiBase, realtimeBase, token]);

  const refreshCredentials = useCallback(
    async (providerId: string) => {
      const list = await listCredentials(providerId);
      setCredentials((current) => ({ ...current, [providerId]: list }));
      return list;
    },
    [],
  );

  const loadAll = useCallback(async () => {
    applyRuntime();
    const list = await listProviders();
    setProviders(list);
    const pairs = await Promise.all(
      list.map(async (provider) => [provider.id, await listCredentials(provider.id)] as const),
    );
    setCredentials(Object.fromEntries(pairs));
    setPrefs(prefsFromUserModels(await listUserModels()));
  }, [applyRuntime]);

  useEffect(() => {
    if (!apiBase.trim()) return;
    loadAll().catch((reason: unknown) => setError(errorText(reason)));
    // 只在打开弹窗时加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireApiBase = () => {
    if (!apiBase.trim()) throw new Error("请先填写 AI 接口地址");
    applyRuntime();
  };

  const reloadProviders = async () => {
    setProviders(await listProviders());
  };

  const openBind = (providerId: string, credential?: CredentialInfo) => {
    setBinding({ providerId, ...(credential ? { credential } : {}) });
    setBindLabel(credential?.label ?? "默认");
    setBindKey("");
    setError(null);
  };

  const syncModels = async (providerId: string) => {
    requireApiBase();
    setBusy(`sync:${providerId}`);
    setError(null);
    try {
      const list = await syncProviderModels(providerId);
      setModels((current) => ({ ...current, [providerId]: list }));
      setExpanded(providerId);
      pushToast("模型列表已同步", "success");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const submitBind = async () => {
    if (!binding) return;
    const key = bindKey.trim();
    if (!key) {
      setError("请填写 API Key");
      return;
    }
    requireApiBase();
    setBusy("bind");
    setError(null);
    try {
      const saved = binding.credential
        ? await updateCredential(binding.providerId, binding.credential.id, {
            apiKey: key,
            ...(bindLabel.trim() ? { label: bindLabel.trim() } : {}),
          })
        : await createCredential(binding.providerId, {
            label: bindLabel.trim() || "默认",
            apiKey: key,
          });
      setBinding(null);
      setBusy("verify");
      try {
        await testCredential(binding.providerId, saved.id);
        const list = await syncProviderModels(binding.providerId);
        setModels((current) => ({ ...current, [binding.providerId]: list }));
        setExpanded(binding.providerId);
        pushToast("Key 校验通过，模型已同步", "success");
      } catch (reason) {
        setError(errorText(reason));
      }
      await reloadProviders();
      await refreshCredentials(binding.providerId);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async (providerId: string, credential: CredentialInfo) => {
    if (!window.confirm(`确定删除「${credential.label}」这个 Key 吗？`)) return;
    requireApiBase();
    setBusy(`delete:${credential.id}`);
    setError(null);
    try {
      await deleteCredential(providerId, credential.id);
      await reloadProviders();
      await refreshCredentials(providerId);
      pushToast("已删除 Key", "success");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const verifyKey = async (providerId: string, credential: CredentialInfo) => {
    requireApiBase();
    setBusy(`test:${credential.id}`);
    setError(null);
    try {
      await testCredential(providerId, credential.id);
      await refreshCredentials(providerId);
      pushToast("Key 校验通过", "success");
    } catch (reason) {
      setError(errorText(reason));
      await refreshCredentials(providerId).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const toggleExpanded = async (providerId: string) => {
    if (expanded === providerId) {
      setExpanded(null);
      return;
    }
    setExpanded(providerId);
    if (models[providerId]) return;
    requireApiBase();
    setBusy(`models:${providerId}`);
    setError(null);
    try {
      const list = await listProviderModels(providerId);
      setModels((current) => ({ ...current, [providerId]: list }));
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const toggleModel = (model: ProviderModelInfo) => {
    if (!model.enabled) return;
    setPrefs((current) => {
      const value = current[model.id] ?? { enabled: false, isDefault: false };
      return {
        ...current,
        [model.id]: { enabled: !value.enabled, isDefault: value.enabled ? false : value.isDefault },
      };
    });
    setPrefsDirty(true);
  };

  const setDefaultModel = (model: ProviderModelInfo) => {
    setPrefs((current) => {
      const next: PrefState = { ...current };
      for (const [id, value] of Object.entries(next)) {
        const candidate = Object.values(models)
          .flat()
          .find((item) => item.id === id);
        if (candidate && candidate.kind === model.kind && id !== model.id && value.isDefault) {
          next[id] = { ...value, isDefault: false };
        }
      }
      const currentValue = next[model.id] ?? { enabled: true, isDefault: false };
      next[model.id] = { enabled: true, isDefault: !currentValue.isDefault };
      return next;
    });
    setPrefsDirty(true);
  };

  const savePrefs = async () => {
    requireApiBase();
    setBusy("prefs");
    setError(null);
    try {
      const payload = Object.entries(prefs)
        .filter(([, value]) => value.enabled)
        .map(([providerModelId, value]) => ({
          providerModelId,
          enabled: true,
          isDefault: value.isDefault,
        }));
      const saved = await saveUserModels(payload);
      setPrefs(prefsFromUserModels(saved));
      setPrefsDirty(false);
      clearModelCache();
      pushToast("模型选择已保存", "success");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    applyRuntime();
    onClose();
  };

  const byokReady = Boolean(apiBase.trim());

  return (
    <Modal onClose={onClose} className="modal ai-settings" labelledBy="ai-settings-title">
      <DialogHeader id="ai-settings-title" title="AI 设置" onClose={onClose} />
      <div className="ai-settings-body">
        <p className="ai-settings-note">
          {isAiMock()
            ? "当前为模拟模式。填写接口地址后会使用真实接口。"
            : "当前使用真实 AI 接口。"}
        </p>
        <Field label="接口地址">
          <Input
            value={apiBase}
            placeholder="https://api.example.com/v1"
            onChange={(event) => setApiBase(event.target.value)}
          />
        </Field>
        <Field label="实时通道地址（必填）">
          <Input
            value={realtimeBase}
            placeholder="wss://api.example.com"
            onChange={(event) => setRealtimeBase(event.target.value)}
          />
        </Field>
        <Field label="访问令牌">
          <Input
            type="password"
            value={token}
            placeholder="访问令牌"
            onChange={(event) => setToken(event.target.value)}
          />
        </Field>

        <div className="ai-settings-divider" />
        <h3 className="ai-settings-title">我的供应商</h3>
        <p className="ai-settings-note">
          Key 加密保存在服务器，只显示掩码。绑定后可同步供应商模型，并在画布中使用自己的额度。
        </p>

        {!byokReady ? (
          <p className="ai-settings-hint">填写接口地址并保存后，即可管理供应商 Key。</p>
        ) : (
          <div className="ai-provider-list">
            {providers.map((provider) => {
              const providerCredentials = credentials[provider.id] ?? [];
              const providerModels = models[provider.id] ?? [];
              const bindingHere = binding?.providerId === provider.id;
              const isBusy = busy?.endsWith(`:${provider.id}`) ?? false;
              return (
                <div className="ai-provider-card" key={provider.id}>
                  <div className="ai-provider-head">
                    <div className="ai-provider-title">
                      <strong>{provider.name}</strong>
                      <span
                        className={
                          providerCredentials.length > 0
                            ? "ai-provider-state is-bound"
                            : "ai-provider-state"
                        }
                      >
                        {providerCredentials.length > 0
                          ? `${providerCredentials.length} 个 Key`
                          : "未绑定"}
                      </span>
                    </div>
                    <div className="ai-provider-actions">
                      {provider.docsUrl ? (
                        <a
                          className="ai-provider-doc"
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          文档
                        </a>
                      ) : null}
                      <Button size="xs" onClick={() => openBind(provider.id)} disabled={isBusy}>
                        绑定 Key
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => void toggleExpanded(provider.id)}
                        disabled={isBusy || providerCredentials.length === 0}
                      >
                        {expanded === provider.id ? "收起模型" : "模型"}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void syncModels(provider.id)}
                        disabled={
                          isBusy || providerCredentials.length === 0 || !provider.supportsModels
                        }
                      >
                        同步
                      </Button>
                    </div>
                  </div>

                  {providerCredentials.length > 0 ? (
                    <div className="ai-credential-list">
                      {providerCredentials.map((credential) => (
                        <div className="ai-credential-row" key={credential.id}>
                          <span className="ai-credential-label">{credential.label}</span>
                          <code>{credential.keyMask}</code>
                          <span className={`ai-credential-status is-${credential.status}`}>
                            {statusLabel(credential.status)}
                          </span>
                          <div className="ai-credential-actions">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => void verifyKey(provider.id, credential)}
                              disabled={busy !== null}
                            >
                              测试
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => openBind(provider.id, credential)}
                              disabled={busy !== null}
                            >
                              替换
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => void removeKey(provider.id, credential)}
                              disabled={busy !== null}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {bindingHere ? (
                    <div className="ai-bind-form">
                      <Field label="备注">
                        <Input
                          value={bindLabel}
                          placeholder="默认"
                          onChange={(event) => setBindLabel(event.target.value)}
                        />
                      </Field>
                      <Field label="API Key">
                        <Input
                          type="password"
                          value={bindKey}
                          placeholder="sk-..."
                          autoComplete="off"
                          onChange={(event) => setBindKey(event.target.value)}
                        />
                      </Field>
                      <div className="ai-bind-actions">
                        <Button size="sm" onClick={() => setBinding(null)}>
                          取消
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => void submitBind()}
                          disabled={busy !== null}
                        >
                          {binding?.credential ? "替换并校验" : "保存并校验"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {expanded === provider.id ? (
                    <div className="ai-model-list">
                      {providerModels.length === 0 ? (
                        <p className="ai-settings-hint">暂无模型，点击「同步」从供应商获取。</p>
                      ) : (
                        providerModels.map((model) => {
                          const pref = prefs[model.id] ?? { enabled: false, isDefault: false };
                          return (
                            <div
                              className={model.enabled ? "ai-model-row" : "ai-model-row is-disabled"}
                              key={model.id}
                            >
                              <input
                                type="checkbox"
                                checked={pref.enabled}
                                disabled={!model.enabled}
                                onChange={() => toggleModel(model)}
                              />
                              <span className="ai-model-name">{model.displayName}</span>
                              <span className="ai-model-kind">{model.kind}</span>
                              {!model.enabled ? (
                                <span className="ai-model-badge">未开通</span>
                              ) : null}
                              {pref.isDefault ? (
                                <span className="ai-model-badge is-default">默认</span>
                              ) : null}
                              {model.enabled && pref.enabled ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => setDefaultModel(model)}
                                >
                                  {pref.isDefault ? "取消默认" : "设为默认"}
                                </Button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                      {prefsDirty ? (
                        <div className="ai-model-actions">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void savePrefs()}
                            disabled={busy !== null}
                          >
                            保存模型选择
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {error ? <p className="ai-settings-error">{error}</p> : null}

        <div className="ai-settings-actions">
          <Button size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={save}>
            保存并关闭
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AiSettingsDialog() {
  const open = useUiStore((state) => state.aiSettingsOpen);
  const setOpen = useUiStore((state) => state.setAiSettingsOpen);
  if (!open) return null;
  return <AiSettingsForm onClose={() => setOpen(false)} />;
}
