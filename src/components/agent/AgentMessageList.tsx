import { useEffect, useRef } from "react";
import type { AgentMessage, AgentStatus } from "../../lib/ai/agent/types";
import { AgentPlanCard } from "./AgentPlanCard";
import { AgentResultCard } from "./AgentResultCard";

type AgentMessageListProps = {
  messages: AgentMessage[];
  status: AgentStatus;
  onExecute: (message: AgentMessage) => void;
  onCancel: (message: AgentMessage) => void;
  onUndo: (message: AgentMessage) => void;
};

export function AgentMessageList({
  messages,
  status,
  onExecute,
  onCancel,
  onUndo,
}: AgentMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, status]);

  return (
    <div className="agent-messages">
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="agent-row agent-row-user">
              <div className="agent-bubble agent-bubble-user">{message.content}</div>
            </div>
          );
        }

        if (message.kind === "plan") {
          return (
            <div key={message.id} className="agent-row agent-row-assistant">
              <div className="agent-bubble agent-bubble-assistant">
                <p className="agent-bubble-text">{message.content}</p>
                <AgentPlanCard
                  message={message}
                  disabled={status !== "idle"}
                  onExecute={() => onExecute(message)}
                  onCancel={() => onCancel(message)}
                />
              </div>
            </div>
          );
        }

        if (message.kind === "execution") {
          return (
            <div key={message.id} className="agent-row agent-row-assistant">
              <AgentResultCard message={message} onUndo={() => onUndo(message)} />
            </div>
          );
        }

        const tone =
          message.kind === "error"
            ? " agent-bubble-error"
            : message.kind === "clarification"
              ? " agent-bubble-clarify"
              : "";

        return (
          <div key={message.id} className="agent-row agent-row-assistant">
            <div className={`agent-bubble agent-bubble-assistant${tone}`}>
              {message.content}
            </div>
          </div>
        );
      })}
      {status === "planning" ? (
        <div className="agent-row agent-row-assistant">
          <div className="agent-bubble agent-bubble-assistant agent-thinking">
            正在理解…
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
