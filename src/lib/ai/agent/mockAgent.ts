import type {
  AgentChatResponse,
  AgentContext,
  AgentContextNode,
  AiCommand,
} from "./types";

const CN_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function countFrom(text: string): number {
  const digit = /(\d+)\s*个/.exec(text);
  if (digit) return Math.max(1, Math.min(10, Number(digit[1])));
  const cn = /([一二两三四五六七八九十])\s*个/.exec(text);
  if (cn) return CN_NUMBERS[cn[1]] ?? 1;
  return 1;
}

function selectedNodes(context: AgentContext): AgentContextNode[] {
  const ids = new Set(context.selectedNodeIds);
  const found = context.nodes.filter((node) => ids.has(node.id));
  const order = new Map(context.selectedNodeIds.map((id, index) => [id, index]));
  return found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

function emptyTextNodes(context: AgentContext): AgentContextNode[] {
  return context.nodes.filter(
    (node) => node.type === "text" && node.text.trim().length === 0,
  );
}

function summaryOf(context: AgentContext): string {
  const counts = new Map<string, number>();
  for (const node of context.nodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }
  const parts = [
    `文本 ${counts.get("text") ?? 0}`,
    `图片 ${counts.get("image") ?? 0}`,
    `视频 ${counts.get("video") ?? 0}`,
    `分组 ${context.groups.length}`,
  ];
  return `画布共 ${context.totalNodes} 个节点，已加载 ${context.nodes.length} 个：${parts.join("，")}。`;
}

function alignKind(text: string): AiCommand & { op: "align" } | null {
  if (!/对齐|排列|排齐/.test(text)) return null;
  if (/左/.test(text)) return { op: "align", nodeIds: [], kind: "left" };
  if (/右/.test(text)) return { op: "align", nodeIds: [], kind: "right" };
  if (/顶|上/.test(text)) return { op: "align", nodeIds: [], kind: "top" };
  if (/底|下/.test(text)) return { op: "align", nodeIds: [], kind: "bottom" };
  if (/垂直居中|上下居中/.test(text)) {
    return { op: "align", nodeIds: [], kind: "centerY" };
  }
  if (/水平居中|左右居中/.test(text)) {
    return { op: "align", nodeIds: [], kind: "centerX" };
  }
  return { op: "align", nodeIds: [], kind: "centerX" };
}

function withIds(command: AiCommand, ids: string[]): AiCommand {
  if (command.op === "align") return { ...command, nodeIds: ids };
  if (command.op === "distribute") return { ...command, nodeIds: ids };
  return command;
}

function planResponse(message: string, summary: string, commands: AiCommand[]): AgentChatResponse {
  return { kind: "plan", message, summary, commands };
}

function reply(message: string): AgentChatResponse {
  return { kind: "reply", message };
}

function clarify(message: string): AgentChatResponse {
  return { kind: "clarify", message, clarification: message };
}

export function runMockAgent(text: string, context: AgentContext): AgentChatResponse {
  const input = text.trim();
  const selected = selectedNodes(context);
  const selectedIds = selected.map((node) => node.id);
  const lower = input.toLowerCase();

  if (!input) return clarify("告诉我你想对画布做什么。");

  if (/看板|kanban/.test(lower) || (/三列|三栏/.test(input) && /新建|创建|添加/.test(input))) {
    return planResponse(
      "我准备插入一个三列看板模板，你可以再让 Agent 往每列添加卡片。",
      "插入三列看板",
      [{ op: "template", templateId: "kanban" }],
    );
  }

  if (/流程图|整理.*流程|横向流程/.test(input)) {
    if (selectedIds.length < 2) {
      return clarify("请先选中至少 2 个节点，我再帮你整理成流程图。");
    }
    return planResponse(
      `我准备左对齐并自动布局选中的 ${selectedIds.length} 个节点。`,
      "整理选中节点为流程图",
      [
        { op: "align", nodeIds: selectedIds, kind: "left" },
        { op: "autoLayout" },
        { op: "select", nodeIds: selectedIds },
      ],
    );
  }

  if (/分布/.test(input)) {
    if (selectedIds.length < 3) {
      return clarify("分布至少需要选中 3 个节点。");
    }
    const axis = /纵向|竖向|上下/.test(input) ? "y" : "x";
    return planResponse(
      `我准备把选中的 ${selectedIds.length} 个节点${axis === "x" ? "横向" : "纵向"}均匀分布。`,
      "分布选中节点",
      [{ op: "distribute", nodeIds: selectedIds, axis }],
    );
  }

  const align = alignKind(input);
  if (align) {
    if (selectedIds.length < 2) {
      return clarify("对齐至少需要选中 2 个节点。");
    }
    return planResponse(
      `我准备对齐选中的 ${selectedIds.length} 个节点。`,
      "对齐选中节点",
      [withIds(align, selectedIds)],
    );
  }

  if (/取消分组|拆组|取消合并/.test(input)) {
    const groups = selected.filter((node) => node.type === "group");
    if (groups.length === 0) return clarify("请先选中一个分组。");
    return planResponse("我准备取消选中的分组。", "取消分组", [
      { op: "ungroup", nodeId: groups[0].id },
    ]);
  }

  if (/分组|合并/.test(input) && !/什么|哪些|几个|多少|里面|里有/.test(input)) {
    if (selectedIds.length < 2) {
      return clarify("分组至少需要选中 2 个节点。");
    }
    return planResponse(
      `我准备把选中的 ${selectedIds.length} 个节点合并成一个分组。`,
      "合并分组",
      [{ op: "group", nodeIds: selectedIds }],
    );
  }

  if (/删除|删掉|移除|清掉/.test(input) && /空(文本|节点)|空白/.test(input)) {
    const empties = emptyTextNodes(context);
    if (empties.length === 0) return reply("当前画布没有空的文本节点。");
    return planResponse(
      `我找到 ${empties.length} 个空文本节点，准备删除它们。`,
      "删除空文本节点",
      [{ op: "delete", nodeIds: empties.map((node) => node.id) }],
    );
  }

  if (/删除|删掉|移除/.test(input)) {
    if (selectedIds.length === 0) {
      return clarify("请先选中要删除的节点，或告诉我要删除哪些节点。");
    }
    return planResponse(
      `我准备删除选中的 ${selectedIds.length} 个节点，删除后可用 Ctrl/Cmd + Z 撤销。`,
      "删除选中节点",
      [{ op: "delete", nodeIds: selectedIds }],
    );
  }

  if (/连接|连线/.test(input)) {
    if (selectedIds.length < 2) {
      return clarify("连接需要选中至少 2 个节点。");
    }
    const ordered = [...selected].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const commands: AiCommand[] = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      commands.push({
        op: "connect",
        from: { id: ordered[index].id },
        to: { id: ordered[index + 1].id },
      });
    }
    return planResponse("我准备按从左到右的顺序连接选中的节点。", "连接选中节点", commands);
  }

  if (/新增|新建|添加|加一|加两|加个|加\d/.test(input) && /节点|文本|卡片|标题/.test(input)) {
    const count = countFrom(input);
    const title = /标题/.test(input) ? "标题" : undefined;
    const commands: AiCommand[] = Array.from({ length: count }, (_item, index) => ({
      op: "addNode" as const,
      alias: `new-${index + 1}`,
      kind: "text" as const,
      ...(title ? { title } : {}),
      text: "",
    }));
    return planResponse(
      `我准备新建 ${count} 个文本节点${title ? "，并作为标题" : ""}。`,
      `新建 ${count} 个文本节点`,
      commands,
    );
  }

  if (/定位|找到|选中/.test(input)) {
    const targets = /空/.test(input) ? emptyTextNodes(context) : selected;
    if (targets.length === 0) {
      if (/空/.test(input)) return reply("当前画布没有空的文本节点。");
      return clarify("请先选中节点，或描述你要找的节点特征。");
    }
    return planResponse(
      `我准备定位并选中 ${targets.length} 个节点。`,
      "定位节点",
      [
        { op: "focus", nodeIds: targets.map((node) => node.id) },
        { op: "select", nodeIds: targets.map((node) => node.id) },
      ],
    );
  }

  if (/几个|多少|数量|统计|有什么|哪些/.test(input)) {
    const empties = emptyTextNodes(context);
    const group = selected.find((node) => node.type === "group");
    if (group) {
      const children = context.nodes.filter((node) => node.parentId === group.id);
      return reply(
        `分组「${group.title}」里有 ${children.length} 个节点：${
          children.map((node) => node.title).join("、") || "空"
        }。\n\n要我把它们展开、对齐或删除吗？`,
      );
    }
    return reply(
      `${summaryOf(context)}\n\n其中空文本节点 ${empties.length} 个。${
        empties.length > 0 ? "要我把它们删除吗？" : ""
      }`,
    );
  }

  if (/全选/.test(input)) {
    return planResponse("我准备选中画布上的全部节点。", "全选节点", [
      { op: "select", nodeIds: context.nodes.map((node) => node.id) },
    ]);
  }

  if (/自动布局|布局/.test(input)) {
    return planResponse("我准备对整个画布执行横向自动布局。", "自动布局", [
      { op: "autoLayout" },
    ]);
  }

  return reply(
    `我可以帮你整理、新建、连接、分组、对齐、分布、删除和定位节点。\n\n${summaryOf(context)}\n\n试试：「把选中的节点整理成横向流程图」或「新建一个三列看板」。`,
  );
}
