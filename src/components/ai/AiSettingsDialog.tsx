import { useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { getAiApiBase, getAiRealtimeBase, isAiMock, setAiRuntimeConfig } from "../../lib/ai/config";
import { getAiToken } from "../../lib/ai/auth";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";

function AiSettingsForm({ onClose }: { onClose: () => void }) {
  const [apiBase, setApiBase] = useState(() => getAiApiBase());
  const [realtimeBase, setRealtimeBase] = useState(() => getAiRealtimeBase());
  const [token, setToken] = useState(() => getAiToken() ?? "");

  const save = () => {
    setAiRuntimeConfig({ apiBase, realtimeBase, token });
    onClose();
  };

  return (
    <Modal onClose={onClose} className="modal ai-settings" labelledBy="ai-settings-title">
      <h2 id="ai-settings-title">AI 设置</h2>
      <p className="ai-settings-note">
        {isAiMock()
          ? "当前为模拟模式。填写接口地址后会使用真实接口。"
          : "当前使用真实 AI 接口。"}
      </p>
      <Field label="接口地址">
        <input
          value={apiBase}
          placeholder="https://api.example.com/v1"
          onChange={(event) => setApiBase(event.target.value)}
        />
      </Field>
      <Field label="实时通道地址（可选）">
        <input
          value={realtimeBase}
          placeholder="wss://api.example.com"
          onChange={(event) => setRealtimeBase(event.target.value)}
        />
      </Field>
      <Field label="访问令牌">
        <input
          type="password"
          value={token}
          placeholder="访问令牌"
          onChange={(event) => setToken(event.target.value)}
        />
      </Field>
      <div className="ai-settings-actions">
        <Button size="md" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" size="md" onClick={save}>
          保存
        </Button>
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
