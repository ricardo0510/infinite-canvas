import type { XYPosition } from "@xyflow/react";
import { useCanvasStore } from "../../../store/canvasStore";
import type { CanvasNode } from "../../../types";
import { resolveNodeRef, validatePlan } from "./validate";
import type { AiCommandPlan } from "./types";

export type ExecutePlanOptions = {
  anchor?: XYPosition;
  focus?: (nodeIds: string[]) => void;
};

export type ExecutePlanResult = {
  affectedNodeIds: string[];
};

export class PlanExecutionError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join("；"));
    this.name = "PlanExecutionError";
    this.errors = errors;
  }
}

const NEW_NODE_GAP_X = 320;
const NEW_NODE_GAP_Y = 220;
const NEW_NODE_COLUMNS = 3;

function selectionAnchor(nodes: CanvasNode[], fallback: XYPosition): XYPosition {
  const selected = nodes.filter((node) => node.selected);
  if (selected.length === 0) return fallback;
  const xs = selected.map((node) => node.position.x);
  const ys = selected.map((node) => node.position.y);
  return {
    x: Math.min(...xs),
    y: Math.max(...ys) + 240,
  };
}

export async function executePlan(
  plan: AiCommandPlan,
  options: ExecutePlanOptions = {},
): Promise<ExecutePlanResult> {
  const validation = validatePlan(plan, useCanvasStore.getState().nodes);
  if (!validation.ok) throw new PlanExecutionError(validation.errors);
  const commandPlan = validation.plan;

  const result: ExecutePlanResult = { affectedNodeIds: [] };
  const affected = new Set<string>();
  const deleted = new Set<string>();

  await useCanvasStore.getState().runBatch(async () => {
    const store = () => useCanvasStore.getState();
    const aliases = new Map<string, string>();
    const start = selectionAnchor(store().nodes, options.anchor ?? { x: 0, y: 0 });
    let createdIndex = 0;

    for (const command of commandPlan.commands) {
      if (command.op !== "template") continue;
      const ids = store().insertTemplate(command.templateId, {
        x: command.anchor?.x ?? start.x,
        y: command.anchor?.y ?? start.y,
      });
      ids.forEach((id) => affected.add(id));
    }

    for (const command of commandPlan.commands) {
      if (command.op !== "addNode") continue;
      const position = {
        x: start.x + (createdIndex % NEW_NODE_COLUMNS) * NEW_NODE_GAP_X,
        y: start.y + Math.floor(createdIndex / NEW_NODE_COLUMNS) * NEW_NODE_GAP_Y,
      };
      createdIndex += 1;
      const id = store().addNode(command.kind, position);
      if (command.alias) aliases.set(command.alias, id);
      const patch: Record<string, string> = {};
      if (command.title) patch.title = command.title;
      if (command.text) patch.text = command.text;
      if (Object.keys(patch).length > 0) store().updateNodeData(id, patch);
      affected.add(id);
    }

    for (const command of commandPlan.commands) {
      if (command.op !== "updateNode") continue;
      const id = resolveNodeRef(command.node, aliases);
      if (!id) continue;
      store().updateNodeData(id, { ...command.patch });
      affected.add(id);
    }

    for (const command of commandPlan.commands) {
      if (command.op !== "connect") continue;
      const source = resolveNodeRef(command.from, aliases);
      const target = resolveNodeRef(command.to, aliases);
      if (!source || !target) continue;
      store().onConnect({ source, target, sourceHandle: null, targetHandle: null });
      affected.add(source);
      affected.add(target);
    }

    for (const command of commandPlan.commands) {
      switch (command.op) {
        case "select": {
          store().selectNodes(command.nodeIds);
          command.nodeIds.forEach((id) => affected.add(id));
          break;
        }
        case "group": {
          store().selectNodes(command.nodeIds);
          const groupId = store().groupSelected();
          if (groupId) {
            if (command.label) store().updateNodeData(groupId, { label: command.label });
            affected.add(groupId);
            command.nodeIds.forEach((id) => affected.add(id));
          }
          break;
        }
        case "ungroup": {
          store().selectNodes([command.nodeId]);
          store().ungroupSelected();
          if (command.nodeId) affected.delete(command.nodeId);
          break;
        }
        case "align": {
          store().selectNodes(command.nodeIds);
          store().alignSelected(command.kind);
          command.nodeIds.forEach((id) => affected.add(id));
          break;
        }
        case "distribute": {
          store().selectNodes(command.nodeIds);
          store().distributeSelected(command.axis);
          command.nodeIds.forEach((id) => affected.add(id));
          break;
        }
        case "delete": {
          store().selectNodes(command.nodeIds);
          store().removeSelected();
          command.nodeIds.forEach((id) => {
            deleted.add(id);
            affected.delete(id);
          });
          break;
        }
        default:
          break;
      }
    }

    if (commandPlan.commands.some((command) => command.op === "autoLayout")) {
      await store().autoLayout();
    }

    const finalIds = [...affected].filter((id) => !deleted.has(id));
    if (finalIds.length > 0) store().selectNodes(finalIds);

    const focusIds = commandPlan.commands.flatMap((command) =>
      command.op === "focus" ? command.nodeIds : [],
    );
    if (focusIds.length > 0) options.focus?.(focusIds);

    result.affectedNodeIds = finalIds;
  });

  return result;
}
