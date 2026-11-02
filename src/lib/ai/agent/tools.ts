import { TEMPLATE_MAP, TEMPLATES } from "../../templates";
import type { AiCommand, AiCommandPlan } from "./types";

export const AGENT_TOOL_OPS = [
  "select",
  "focus",
  "addNode",
  "updateNode",
  "connect",
  "group",
  "ungroup",
  "align",
  "distribute",
  "autoLayout",
  "delete",
  "template",
] as const;

export type AgentToolOp = (typeof AGENT_TOOL_OPS)[number];

const TOOL_SET = new Set<string>(AGENT_TOOL_OPS);

export const MAX_COMMANDS = 30;
export const MAX_DELETE_NODES = 20;
export const MAX_NODES = 200;

export const TEMPLATE_IDS = TEMPLATES.map((template) => template.id);

export function isToolOp(value: unknown): value is AgentToolOp {
  return typeof value === "string" && TOOL_SET.has(value);
}

export function isTemplateId(value: unknown): value is string {
  return typeof value === "string" && value in TEMPLATE_MAP;
}

export function describeCommand(command: AiCommand): string {
  switch (command.op) {
    case "select":
      return `选中 ${command.nodeIds.length} 个节点`;
    case "focus":
      return `定位到 ${command.nodeIds.length} 个节点`;
    case "addNode":
      return `新建${command.kind === "text" ? "文本" : command.kind === "image" ? "图片" : "视频"}节点${command.title ? `「${command.title}」` : ""}`;
    case "updateNode":
      return "修改节点内容";
    case "connect":
      return "连接两个节点";
    case "group":
      return `合并为分组${command.label ? `「${command.label}」` : ""}`;
    case "ungroup":
      return "取消分组";
    case "align":
      return `${alignLabel(command.kind)} ${command.nodeIds.length} 个节点`;
    case "distribute":
      return `${command.axis === "x" ? "横向" : "纵向"}分布 ${command.nodeIds.length} 个节点`;
    case "autoLayout":
      return "自动布局";
    case "delete":
      return `删除 ${command.nodeIds.length} 个节点`;
    case "template":
      return `插入模板「${TEMPLATE_MAP[command.templateId]?.label ?? command.templateId}」`;
    default:
      return "未知动作";
  }
}

export function describePlan(plan: AiCommandPlan): string {
  return plan.commands.map((command) => describeCommand(command)).join("；");
}

export function alignLabel(kind: Extract<AiCommand, { op: "align" }>["kind"]): string {
  switch (kind) {
    case "left":
      return "左对齐";
    case "centerX":
      return "水平居中";
    case "right":
      return "右对齐";
    case "top":
      return "顶部对齐";
    case "centerY":
      return "垂直居中";
    default:
      return "底部对齐";
  }
}

export function isDestructive(command: AiCommand): boolean {
  return command.op === "delete";
}

export function planDanger(plan: AiCommandPlan): {
  destructive: boolean;
  deleteCount: number;
  needsSecondConfirm: boolean;
} {
  const deleteCount = plan.commands.reduce(
    (count, command) => (command.op === "delete" ? count + command.nodeIds.length : count),
    0,
  );
  return {
    destructive: plan.commands.some(isDestructive),
    deleteCount,
    needsSecondConfirm: deleteCount > MAX_DELETE_NODES,
  };
}
