import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "infinite-canvas:ai-agent:v1";

function persist(messages: unknown[]): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ messages, modelId: "mock" }),
  );
}

function message(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "m-1",
    role: "assistant",
    kind: "plan",
    content: "准备执行",
    createdAt: 1,
    planStatus: "pending",
    plan: { summary: "整理", commands: [{ op: "autoLayout" }] },
    ...patch,
  };
}

async function loadStore() {
  vi.resetModules();
  const module = await import("./agentStore");
  return module.useAgentStore;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("agentStore session restore", () => {
  it("restores a valid plan", async () => {
    persist([message()]);
    const store = await loadStore();

    expect(store.getState().messages).toHaveLength(1);
    expect(store.getState().messages[0].planStatus).toBe("pending");
  });

  it("drops messages with malformed plans instead of crashing the plan card", async () => {
    persist([message({ plan: { summary: "坏计划", commands: "oops" } })]);
    const store = await loadStore();

    expect(store.getState().messages).toEqual([]);
  });

  it("turns an interrupted execution into a failed plan", async () => {
    persist([message({ planStatus: "executing" })]);
    const store = await loadStore();

    expect(store.getState().messages[0].planStatus).toBe("failed");
  });
});
