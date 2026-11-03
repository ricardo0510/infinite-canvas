import { Button } from "../ui/Button";
import type { AgentMessage } from "../../lib/ai/agent/types";
import { useCanvasStore } from "../../store/canvasStore";

type AgentResultCardProps = {
  message: AgentMessage;
  onUndo: () => void;
};

export function AgentResultCard({ message, onUndo }: AgentResultCardProps) {
  const affected = message.affectedNodeIds ?? [];
  const historyRevision = useCanvasStore((state) => state.historyRevision);
  const recorded = typeof message.historyRevision === "number";
  const canUndo =
    message.undone !== true && recorded && message.historyRevision === historyRevision;
  const label = message.undone
    ? "已撤销"
    : !recorded
      ? "不可撤销"
      : !canUndo
        ? "已失效"
        : "撤销";

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
          disabled={!canUndo}
          title={
            !canUndo && !message.undone
              ? recorded
                ? "画布已有新的修改，无法只撤销这一步"
                : "这次执行没有产生可撤销的修改"
              : undefined
          }
        >
          {label}
        </Button>
      </div>
    </div>
  );
}
