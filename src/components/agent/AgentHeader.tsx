import { Select, type SelectOption } from "../ui/Control";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

type AgentHeaderProps = {
  modelId: string;
  options: SelectOption[];
  loading: boolean;
  error: string | null;
  executing: boolean;
  onModelChange: (value: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function AgentHeader({
  modelId,
  options,
  loading,
  error,
  executing,
  onModelChange,
  onNewChat,
  onClose,
  onOpenSettings,
}: AgentHeaderProps) {
  const noModels = !loading && !error && options.every((option) => option.value === "mock");

  return (
    <header className="agent-header">
      <div className="agent-title">
        <span className="agent-mark" aria-hidden="true">
          <Icon name="sparkles" size={15} />
        </span>
        <div className="agent-title-copy">
          <strong>AI Agent</strong>
          <span>{error ? "模型加载失败" : loading ? "加载模型…" : "画布助手"}</span>
        </div>
      </div>
      <div className="agent-header-actions">
        <Select
          className="agent-model-select"
          controlSize="sm"
          value={modelId}
          options={options}
          placeholder="选择模型"
          ariaLabel="选择文本模型"
          disabled={loading}
          onChange={onModelChange}
        />
        <Button
          variant="ghost"
          size="sm"
          icon
          title={executing ? "执行中，无法开始新对话" : "新对话"}
          aria-label="新对话"
          disabled={executing}
          onClick={onNewChat}
        >
          <Icon name="plus" size={15} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon
          title="关闭 AI Agent"
          aria-label="关闭 AI Agent"
          onClick={onClose}
        >
          <Icon name="close" size={15} />
        </Button>
      </div>
      {noModels ? (
        <div className="agent-model-hint">
          还没有可用的文本模型。
          <button type="button" className="agent-link" onClick={onOpenSettings}>
            去绑定 API Key
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="agent-model-hint agent-model-hint-error">
          {error}
          <button type="button" className="agent-link" onClick={onOpenSettings}>
            AI 设置
          </button>
        </div>
      ) : null}
    </header>
  );
}
