import { useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useAiModels } from "../../lib/ai/useModels";
import { MOCK_MODEL_ID, requestAgentChat } from "../../lib/ai/agent/client";
import { buildAgentContext, buildChatMessages } from "../../lib/ai/agent/context";
import { executePlan } from "../../lib/ai/agent/executor";
import { runMockAgent } from "../../lib/ai/agent/mockAgent";
import { describeCommand } from "../../lib/ai/agent/tools";
import type { AgentChatResponse, AgentMessage } from "../../lib/ai/agent/types";
import { byId, nodeRect } from "../../lib/geometry";
import {
  createAgentMessage,
  useAgentStore,
} from "../../store/agentStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useUiStore } from "../../store/uiStore";
import { AgentComposer } from "./AgentComposer";
import { AgentHeader } from "./AgentHeader";
import { AgentMessageList } from "./AgentMessageList";

const SUGGESTIONS = ["整理选中的节点", "新建一个三列看板", "找到空文本节点"];

const MOCK_OPTION = { value: MOCK_MODEL_ID, label: "本地演示（离线规则）" };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AgentPanel() {
  const { models, loading, error } = useAiModels("text");
  const messages = useAgentStore((state) => state.messages);
  const status = useAgentStore((state) => state.status);
  const modelId = useAgentStore((state) => state.modelId);
  const addMessage = useAgentStore((state) => state.addMessage);
  const updateMessage = useAgentStore((state) => state.updateMessage);
  const clear = useAgentStore((state) => state.clear);
  const setModelId = useAgentStore((state) => state.setModelId);
  const setStatus = useAgentStore((state) => state.setStatus);
  const setAgentOpen = useUiStore((state) => state.setAgentOpen);
  const setAiSettingsOpen = useUiStore((state) => state.setAiSettingsOpen);
  const selectedCount = useCanvasStore(
    (state) => state.nodes.filter((node) => node.selected).length,
  );
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef(0);
  const [draft, setDraft] = useState({ text: "", version: 0 });

  const options = useMemo(
    () => [
      ...models.map((model) => ({ value: model.id, label: model.name })),
      MOCK_OPTION,
    ],
    [models],
  );

  useEffect(() => {
    if (loading) return;
    if (!options.some((option) => option.value === modelId)) {
      setModelId(options[0]?.value ?? MOCK_MODEL_ID);
    }
  }, [loading, options, modelId, setModelId]);

  useEffect(() => {
    textareaRef.current?.focus();
    const focus = () => textareaRef.current?.focus();
    window.addEventListener("ic:focus-agent", focus);
    return () => window.removeEventListener("ic:focus-agent", focus);
  }, []);

  const appendError = (message: string) => {
    addMessage(
      createAgentMessage({
        role: "assistant",
        kind: "error",
        content: message,
      }),
    );
  };

  const applyResponse = (response: AgentChatResponse) => {
    if (response.kind === "plan") {
      addMessage(
        createAgentMessage({
          role: "assistant",
          kind: "plan",
          content: response.message,
          plan: {
            summary: response.summary,
            commands: response.commands,
            ...(response.clarification ? { clarification: response.clarification } : {}),
          },
          planStatus: "pending",
        }),
      );
      return;
    }
    if (response.kind === "clarify") {
      addMessage(
        createAgentMessage({
          role: "assistant",
          kind: "clarification",
          content: response.message,
        }),
      );
      return;
    }
    addMessage(
      createAgentMessage({
        role: "assistant",
        kind: "text",
        content: response.message,
      }),
    );
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || useAgentStore.getState().status !== "idle") return;

    setDraft((current) => ({ text: "", version: current.version + 1 }));
    addMessage(
      createAgentMessage({ role: "user", kind: "text", content: text }),
    );
    setStatus("planning");
    const requestId = ++requestRef.current;

    try {
      const canvas = useCanvasStore.getState();
      const context = buildAgentContext({
        nodes: canvas.nodes,
        edges: canvas.edges,
        viewport: canvas.viewport,
      });
      const response =
        modelId === MOCK_MODEL_ID
          ? await delay(280).then(() => runMockAgent(text, context))
          : await requestAgentChat({
              modelId,
              messages: buildChatMessages(useAgentStore.getState().messages),
              context,
            });
      if (requestId !== requestRef.current) return;
      applyResponse(response);
    } catch (reason) {
      if (requestId !== requestRef.current) return;
      setDraft((current) => ({ text, version: current.version + 1 }));
      appendError(reason instanceof Error ? reason.message : "Agent 请求失败，请重试。");
    } finally {
      if (requestId === requestRef.current) setStatus("idle");
    }
  };

  const execute = async (message: AgentMessage) => {
    const current = useAgentStore.getState().messages.find((item) => item.id === message.id);
    const plan = message.plan;
    if (!plan || message.planStatus !== "pending") return;
    if (useAgentStore.getState().status !== "idle" || current?.planStatus !== "pending") return;
    updateMessage(message.id, { planStatus: "executing" });
    setStatus("executing");

    const canvas = document.querySelector<HTMLElement>(".canvas");
    const rect = canvas?.getBoundingClientRect();
    const anchor = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
    });

    const focus = (nodeIds: string[]) => {
      const state = useCanvasStore.getState();
      const index = byId(state.nodes);
      const node = nodeIds
        .map((id) => index.get(id))
        .find((item) => item !== undefined);
      if (!node) return;
      const box = nodeRect(node, index);
      const zoom = Math.min(1.25, Math.max(0.6, getZoom()));
      void setCenter(box.x + box.width / 2, box.y + box.height / 2, {
        zoom,
        duration: 350,
      });
    };

    try {
      const result = await executePlan(plan, { anchor, focus });
      updateMessage(message.id, {
        planStatus: "done",
        affectedNodeIds: result.affectedNodeIds,
      });
      addMessage(
        createAgentMessage({
          role: "assistant",
          kind: "execution",
          content: `已执行 ${plan.commands.length} 个动作：\n${plan.commands
            .map((command) => `· ${describeCommand(command)}`)
            .join("\n")}`,
          affectedNodeIds: result.affectedNodeIds,
        }),
      );
    } catch (reason) {
      updateMessage(message.id, { planStatus: "failed" });
      appendError(
        reason instanceof Error ? reason.message : "计划执行失败，画布已恢复到执行前。",
      );
    } finally {
      setStatus("idle");
    }
  };

  const cancel = (message: AgentMessage) => {
    updateMessage(message.id, {
      planStatus: "failed",
      content: `${message.content}\n\n已取消，画布没有被修改。`,
    });
  };

  const undo = (message: AgentMessage) => {
    useCanvasStore.getState().undo();
    updateMessage(message.id, { undone: true });
  };

  const close = () => setAgentOpen(false);

  const newChat = () => {
    requestRef.current += 1;
    clear();
  };

  return (
    <aside className="agent-panel" aria-label="AI Agent">
      <AgentHeader
        modelId={modelId}
        options={options}
        loading={loading}
        error={error}
        onModelChange={setModelId}
        onNewChat={newChat}
        onClose={close}
        onOpenSettings={() => setAiSettingsOpen(true)}
      />

      {messages.length === 0 ? (
        <div className="agent-empty">
          <div className="agent-empty-mark" aria-hidden="true">
            <span className="agent-empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 14.5 18.8 17l2.2.8-2.2.8L18 21l-.8-2.4L15 17.8l2.2-.8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <h2>问点什么，或者直接下指令</h2>
          <p>
            我会先给出操作计划，只有你确认后才会改动画布。对话内容和压缩后的画布上下文会发送到所选模型供应商。
          </p>
          <div className="agent-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="agent-suggestion"
                disabled={status !== "idle"}
                onClick={() => void send(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <AgentMessageList
          messages={messages}
          status={status}
          onExecute={(message) => void execute(message)}
          onCancel={cancel}
          onUndo={undo}
        />
      )}

      <AgentComposer
        key={draft.version}
        selectedCount={selectedCount}
        status={status}
        textareaRef={textareaRef}
        initialValue={draft.text}
        onSend={(text) => void send(text)}
      />
    </aside>
  );
}
