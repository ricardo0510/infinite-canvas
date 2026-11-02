import { useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import type { AgentStatus } from "../../lib/ai/agent/types";

type AgentComposerProps = {
  selectedCount: number;
  status: AgentStatus;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  initialValue: string;
  onSend: (text: string) => void;
};

export function AgentComposer({
  selectedCount,
  status,
  textareaRef,
  initialValue,
  onSend,
}: AgentComposerProps) {
  const [value, setValue] = useState(initialValue);
  const busy = status !== "idle";

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue("");
    onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="agent-composer">
      <div className="agent-context-chip">
        {selectedCount > 0 ? `已选 ${selectedCount} 个节点` : "未选中节点"}
      </div>
      <div className="agent-input-row">
        <textarea
          ref={textareaRef}
          className="control control--md control--area agent-input"
          rows={2}
          autoFocus
          value={value}
          placeholder={
            busy ? "Agent 正在处理…" : "继续告诉 Agent 要做什么…（Enter 发送）"
          }
          aria-label="给 AI Agent 的指令"
          disabled={status === "executing"}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          variant="primary"
          size="md"
          icon
          className="agent-send"
          aria-label="发送"
          title="发送（Enter）"
          disabled={busy || value.trim().length === 0}
          onClick={submit}
        >
          <Icon name="send" size={15} />
        </Button>
      </div>
    </div>
  );
}
