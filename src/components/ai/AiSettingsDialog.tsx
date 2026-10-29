import { useEffect, useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { getAiApiBase, getAiRealtimeBase, isAiMock, setAiRuntimeConfig } from "../../lib/ai/config";
import { getAiToken } from "../../lib/ai/auth";

function AiSettingsForm({ onClose }: { onClose: () => void }) {
  const [apiBase, setApiBase] = useState(() => getAiApiBase());
  const [realtimeBase, setRealtimeBase] = useState(() => getAiRealtimeBase());
  const [token, setToken] = useState(() => getAiToken() ?? "");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const save = () => {
    setAiRuntimeConfig({ apiBase, realtimeBase, token });
    onClose();
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal ai-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h2 id="ai-settings-title">AI 设置</h2>
        <p className="ai-settings-note">
          {isAiMock()
            ? "当前为模拟模式。填写接口地址后会使用真实接口。"
            : "当前使用真实 AI 接口。"}
        </p>
        <label className="ai-field">
          <span>接口地址</span>
          <input
            value={apiBase}
            placeholder="https://api.example.com/v1"
            onChange={(event) => setApiBase(event.target.value)}
          />
        </label>
        <label className="ai-field">
          <span>实时通道地址（可选）</span>
          <input
            value={realtimeBase}
            placeholder="wss://api.example.com"
            onChange={(event) => setRealtimeBase(event.target.value)}
          />
        </label>
        <label className="ai-field">
          <span>访问令牌</span>
          <input
            type="password"
            value={token}
            placeholder="访问令牌"
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <div className="ai-settings-actions">
          <button type="button" className="ai-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="ai-primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function AiSettingsDialog() {
  const open = useUiStore((state) => state.aiSettingsOpen);
  const setOpen = useUiStore((state) => state.setAiSettingsOpen);
  if (!open) return null;
  return <AiSettingsForm onClose={() => setOpen(false)} />;
}
