import { useState } from "react";
import { Button } from "../ui/Button";
import {
  describeCommand,
  MAX_DELETE_NODES,
  planDanger,
} from "../../lib/ai/agent/tools";
import type { AgentMessage } from "../../lib/ai/agent/types";

type AgentPlanCardProps = {
  message: AgentMessage;
  disabled: boolean;
  onExecute: () => void;
  onCancel: () => void;
};

export function AgentPlanCard({
  message,
  disabled,
  onExecute,
  onCancel,
}: AgentPlanCardProps) {
  const [confirming, setConfirming] = useState(false);
  const plan = message.plan;
  if (!plan) return null;

  const danger = planDanger(plan);
  const status = message.planStatus ?? "pending";
  const locked = disabled || status !== "pending";
  const actionable = status === "pending" || status === "executing";

  const execute = () => {
    if (danger.needsSecondConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onExecute();
  };

  return (
    <div className={`agent-plan${danger.destructive ? " is-danger" : ""}`}>
      <div className="agent-plan-head">
        <strong>{plan.summary}</strong>
        {danger.destructive ? <span className="agent-plan-tag">破坏性操作</span> : null}
      </div>
      <ol className="agent-plan-list">
        {plan.commands.map((command, index) => (
          <li
            key={`${message.id}-${index}`}
            className={command.op === "delete" ? "is-danger" : undefined}
          >
            {describeCommand(command)}
          </li>
        ))}
      </ol>
      {danger.needsSecondConfirm ? (
        <p className="agent-plan-warning">
          本次会删除 {danger.deleteCount} 个节点，超过 {MAX_DELETE_NODES} 个。请再次点击确认。
        </p>
      ) : null}
      <div className="agent-plan-actions">
        {status === "done" ? (
          <span className="agent-plan-status">已执行</span>
        ) : status === "failed" ? (
          <span className="agent-plan-status">未执行</span>
        ) : null}
        {actionable ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={status === "executing"}
            >
              取消
            </Button>
            <Button
              variant={confirming || danger.destructive ? "danger" : "primary"}
              size="sm"
              onClick={execute}
              disabled={locked}
              className={confirming ? "agent-confirm-danger" : undefined}
            >
              {status === "executing"
                ? "执行中…"
                : confirming
                  ? "再次确认执行"
                  : "执行"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
