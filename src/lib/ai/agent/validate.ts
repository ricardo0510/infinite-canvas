import type { NoteColor } from "../../../types";
import type { CanvasNode } from "../../../types";
import { isTemplateId, isToolOp, MAX_COMMANDS } from "./tools";
import type { AiCommand, AiCommandNodeRef, AiCommandPlan } from "./types";

const NOTE_COLORS = new Set(["violet", "cyan", "amber", "emerald"]);
const NODE_KINDS = new Set(["text", "image", "video"]);
const TEXT_LIMIT = 2000;

export type PlanValidation =
  | { ok: true; plan: AiCommandPlan }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string" && item.trim().length > 0)) return null;
  return value.map((item) => item.trim());
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toRef(value: unknown): AiCommandNodeRef | undefined {
  if (!isRecord(value)) return undefined;
  const alias = text(value.alias);
  if (alias) return { alias };
  const id = text(value.id);
  return id ? { id } : undefined;
}

function resolveRef(
  ref: AiCommandNodeRef,
  aliases: Set<string>,
  nodeIds: Set<string>,
): string | undefined {
  if ("alias" in ref) {
    return aliases.has(ref.alias) ? `alias:${ref.alias}` : undefined;
  }
  return nodeIds.has(ref.id) ? ref.id : undefined;
}

function checkIds(
  value: unknown,
  nodeIds: Set<string>,
  label: string,
  errors: string[],
): string[] {
  const list = stringList(value);
  if (!list) {
    errors.push(`${label}的节点列表无效`);
    return [];
  }
  if (list.length === 0) errors.push(`${label}至少需要 1 个节点`);
  for (const id of list) {
    if (!nodeIds.has(id)) errors.push(`${label}引用了不存在的节点 ${id}`);
  }
  return list;
}

export function resolveNodeRef(
  ref: AiCommandNodeRef,
  aliases: Map<string, string>,
): string | undefined {
  return "id" in ref ? ref.id : aliases.get(ref.alias);
}

export function validatePlan(input: unknown, nodes: CanvasNode[]): PlanValidation {
  if (!isRecord(input)) return { ok: false, errors: ["计划格式不正确"] };

  const errors: string[] = [];
  const summary = text(input.summary);
  if (!summary) errors.push("计划缺少摘要");

  const rawCommands = Array.isArray(input.commands) ? input.commands : [];
  if (!Array.isArray(input.commands)) errors.push("commands 必须是数组");
  if (rawCommands.length === 0) errors.push("计划至少需要 1 个动作");
  if (rawCommands.length > MAX_COMMANDS) {
    errors.push(`单轮最多 ${MAX_COMMANDS} 个动作`);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const groupIds = new Set(
    nodes.filter((node) => node.type === "group").map((node) => node.id),
  );
  const aliases = new Set<string>();
  const linked = new Set<string>();
  const commands: AiCommand[] = [];

  rawCommands.forEach((raw, index) => {
    const label = `动作 ${index + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${label}格式不正确`);
      return;
    }
    const op = raw.op;
    if (!isToolOp(op)) {
      errors.push(`${label}使用了不支持的工具 ${String(op)}`);
      return;
    }

    switch (op) {
      case "select":
      case "focus": {
        const list = checkIds(raw.nodeIds, nodeIds, label, errors);
        commands.push({ op, nodeIds: list });
        break;
      }
      case "addNode": {
        const kind = text(raw.kind);
        if (!NODE_KINDS.has(kind)) {
          errors.push(`${label}的节点类型无效`);
          return;
        }
        const alias = text(raw.alias);
        if (alias) {
          if (aliases.has(alias)) errors.push(`别名 ${alias} 重复`);
          aliases.add(alias);
        }
        const title = text(raw.title);
        const body = typeof raw.text === "string" ? raw.text : "";
        if (title.length > 200) errors.push(`${label}的标题过长`);
        if (body.length > TEXT_LIMIT) errors.push(`${label}的文本过长`);
        commands.push({
          op,
          kind: kind as "text" | "image" | "video",
          ...(alias ? { alias } : {}),
          ...(title ? { title } : {}),
          ...(body ? { text: body } : {}),
        });
        break;
      }
      case "updateNode": {
        const ref = toRef(raw.node);
        if (!ref || resolveRef(ref, aliases, nodeIds) === undefined) {
          errors.push(`${label}引用了无效的节点`);
          return;
        }
        const patch = isRecord(raw.patch) ? raw.patch : null;
        if (!patch) {
          errors.push(`${label}缺少 patch`);
          return;
        }
        const next: { title?: string; text?: string; color?: NoteColor } = {};
        if (patch.title !== undefined) {
          const title = text(patch.title);
          if (!title) errors.push(`${label}的标题为空`);
          else next.title = title.slice(0, 200);
        }
        if (patch.text !== undefined) {
          if (typeof patch.text !== "string") errors.push(`${label}的 text 无效`);
          else next.text = patch.text.slice(0, TEXT_LIMIT);
        }
        if (patch.color !== undefined) {
          const color = text(patch.color);
          if (!NOTE_COLORS.has(color)) errors.push(`${label}的颜色无效`);
          else next.color = color as NoteColor;
        }
        if (Object.keys(next).length === 0) {
          errors.push(`${label}没有任何修改`);
          return;
        }
        commands.push({ op, node: ref, patch: next });
        break;
      }
      case "connect": {
        const from = toRef(raw.from);
        const to = toRef(raw.to);
        const fromId = from ? resolveRef(from, aliases, nodeIds) : undefined;
        const toId = to ? resolveRef(to, aliases, nodeIds) : undefined;
        if (!from || fromId === undefined) errors.push(`${label}的起点无效`);
        if (!to || toId === undefined) errors.push(`${label}的终点无效`);
        if (fromId && toId) {
          if (fromId === toId) errors.push(`${label}不能连接同一个节点`);
          const key = `${fromId}->${toId}`;
          if (linked.has(key)) errors.push(`${label}重复连接`);
          linked.add(key);
        }
        if (from && to) commands.push({ op, from, to });
        break;
      }
      case "group": {
        const list = checkIds(raw.nodeIds, nodeIds, label, errors);
        if (list.length < 2) errors.push(`${label}分组至少需要 2 个节点`);
        const name = text(raw.label);
        commands.push({ op, nodeIds: list, ...(name ? { label: name } : {}) });
        break;
      }
      case "ungroup": {
        const id = text(raw.nodeId);
        if (!nodeIds.has(id)) errors.push(`${label}引用了不存在的节点 ${id}`);
        else if (!groupIds.has(id)) errors.push(`${label}的目标不是分组`);
        commands.push({ op, nodeId: id });
        break;
      }
      case "align": {
        const list = checkIds(raw.nodeIds, nodeIds, label, errors);
        if (list.length < 2) errors.push(`${label}对齐至少需要 2 个节点`);
        const kind = text(raw.kind);
        const allowed = ["left", "centerX", "right", "top", "centerY", "bottom"];
        if (!allowed.includes(kind)) {
          errors.push(`${label}的对齐方式无效`);
          break;
        }
        commands.push({
          op,
          nodeIds: list,
          kind: kind as "left" | "centerX" | "right" | "top" | "centerY" | "bottom",
        });
        break;
      }
      case "distribute": {
        const list = checkIds(raw.nodeIds, nodeIds, label, errors);
        if (list.length < 3) errors.push(`${label}分布至少需要 3 个节点`);
        const axis = text(raw.axis);
        if (axis !== "x" && axis !== "y") errors.push(`${label}的分布方向无效`);
        else commands.push({ op, nodeIds: list, axis });
        break;
      }
      case "autoLayout": {
        commands.push({ op });
        break;
      }
      case "delete": {
        const list = checkIds(raw.nodeIds, nodeIds, label, errors);
        commands.push({ op, nodeIds: list });
        break;
      }
      case "template": {
        const templateId = text(raw.templateId);
        if (!isTemplateId(templateId)) errors.push(`${label}的模板不存在`);
        let anchor: { x: number; y: number } | undefined;
        if (raw.anchor !== undefined) {
          if (!isRecord(raw.anchor) || !finite(raw.anchor.x) || !finite(raw.anchor.y)) {
            errors.push(`${label}的锚点无效`);
          } else {
            anchor = { x: raw.anchor.x, y: raw.anchor.y };
          }
        }
        commands.push({ op, templateId, ...(anchor ? { anchor } : {}) });
        break;
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const clarification = text(input.clarification);
  return {
    ok: true,
    plan: {
      summary,
      commands,
      ...(clarification ? { clarification } : {}),
    },
  };
}
