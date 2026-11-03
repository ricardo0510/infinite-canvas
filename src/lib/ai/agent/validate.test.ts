import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../../../types";
import { validatePlan } from "./validate";

function textNode(id: string, selected = false): CanvasNode {
  return {
    id,
    type: "text",
    position: { x: 0, y: 0 },
    data: { title: id, text: "", color: "emerald", fontSize: 14 },
    selected,
  };
}

function groupNode(id: string): CanvasNode {
  return {
    id,
    type: "group",
    position: { x: 0, y: 0 },
    data: { label: id, color: "amber" },
  };
}

const nodes = [textNode("a"), textNode("b"), textNode("c"), groupNode("g")];

describe("validatePlan", () => {
  it("accepts a valid plan and keeps commands", () => {
    const result = validatePlan(
      {
        summary: "整理",
        commands: [
          { op: "align", nodeIds: ["a", "b"], kind: "left" },
          { op: "autoLayout" },
          { op: "select", nodeIds: ["a", "b"] },
        ],
      },
      nodes,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.commands).toHaveLength(3);
  });

  it("rejects unknown tools and missing nodes", () => {
    const result = validatePlan(
      {
        summary: "坏计划",
        commands: [{ op: "runJs", code: "alert(1)" }],
      },
      nodes,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("不支持的工具");
  });

  it("rejects unknown node ids", () => {
    const result = validatePlan(
      {
        summary: "坏计划",
        commands: [{ op: "delete", nodeIds: ["missing"] }],
      },
      nodes,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("不存在");
  });

  it("limits a plan to 30 commands", () => {
    const result = validatePlan(
      {
        summary: "太多",
        commands: Array.from({ length: 31 }, () => ({ op: "autoLayout" })),
      },
      nodes,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("30");
  });

  it("accepts aliases defined by addNode", () => {
    const result = validatePlan(
      {
        summary: "新建并连接",
        commands: [
          { op: "addNode", alias: "n1", kind: "text", title: "开始" },
          { op: "addNode", alias: "n2", kind: "text", title: "结束" },
          { op: "connect", from: { alias: "n1" }, to: { alias: "n2" } },
        ],
      },
      nodes,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.commands).toHaveLength(3);
  });

  it("rejects an undefined alias", () => {
    const result = validatePlan(
      {
        summary: "坏别名",
        commands: [{ op: "updateNode", node: { alias: "nope" }, patch: { title: "x" } }],
      },
      nodes,
    );
    expect(result.ok).toBe(false);
  });

  it("requires a multi-node selection for align and distribute", () => {
    expect(
      validatePlan(
        { summary: "对齐", commands: [{ op: "align", nodeIds: ["a"], kind: "left" }] },
        nodes,
      ).ok,
    ).toBe(false);
    expect(
      validatePlan(
        {
          summary: "分布",
          commands: [{ op: "distribute", nodeIds: ["a", "b"], axis: "x" }],
        },
        nodes,
      ).ok,
    ).toBe(false);
  });

  it("rejects malformed command fields before they reach the plan card", () => {
    const result = validatePlan(
      {
        summary: "坏字段",
        commands: [{ op: "delete", nodeIds: "oops" }],
      },
      nodes,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("节点列表无效");
  });

  it("rejects unknown templates and non-group ungroup", () => {
    expect(
      validatePlan(
        {
          summary: "模板",
          commands: [{ op: "template", templateId: "nope" }],
        },
        nodes,
      ).ok,
    ).toBe(false);
    expect(
      validatePlan(
        { summary: "拆组", commands: [{ op: "ungroup", nodeId: "a" }] },
        nodes,
      ).ok,
    ).toBe(false);
  });
});
