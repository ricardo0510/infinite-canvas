import { Button } from "../ui/Button";
import type { AgentMessage } from "../../lib/ai/agent/types";

type AgentResultCardProps = {
  message: AgentMessage;
  onUndo: () => void;
};

export function AgentResultCard({ message, onUndo }: AgentResultCardProps) {
  const affected = message.affectedNodeIds ?? [];

  return (
    <div className="agent-result">
      <p className="agent-result-text">{message.content}</p>
      {affected.length > 0 ? (
        <p className="agent-result-ids">
          受影响节点：{affected.slice(0, 6).join("、")}
          {affected.length > 6 ? ` 等 ${affected.length} 个` : ""}
        </p>
      ) : null}
      <div className="agent-result-actions">
        <Button
          variant="ghost"
          size="xs"
          onClick={onUndo}
          disabled={message.undone === true}
        >
          {message.undone ? "已撤销" : "撤销"}
        </Button>
      </div>
    </div>
  );
}
