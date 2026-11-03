import type { AgentChatResponse, AgentContextNode } from "./types";

export type AgentEvalCase = {
  id: string;
  input: string;
  nodes: AgentContextNode[];
  selected: string[];
  expect: {
    kind: AgentChatResponse["kind"];
    ops?: string[];
    messageIncludes?: string;
  };
};

export function textNode(
  id: string,
  text = "",
  parentId: string | null = null,
): AgentContextNode {
  return { id, type: "text", title: id, text, parentId };
}

export function groupNode(id: string, label = id): AgentContextNode {
  return { id, type: "group", title: label, text: "", parentId: null };
}

const three = [textNode("a", "开始"), textNode("b", "处理"), textNode("c", "结束")];

export const AGENT_EVALS: AgentEvalCase[] = [
  {
    id: "flowchart",
    input: "把选中的节点整理成横向流程图",
    nodes: three,
    selected: ["a", "b", "c"],
    expect: { kind: "plan", ops: ["align", "autoLayout", "select"] },
  },
  {
    id: "align-left",
    input: "把选中的节点左对齐",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "plan", ops: ["align"] },
  },
  {
    id: "align-right",
    input: "选中的节点右对齐",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "plan", ops: ["align"] },
  },
  {
    id: "align-center",
    input: "把选中的节点居中对齐",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "plan", ops: ["align"] },
  },
  {
    id: "distribute-x",
    input: "把选中节点横向分布",
    nodes: three,
    selected: ["a", "b", "c"],
    expect: { kind: "plan", ops: ["distribute"] },
  },
  {
    id: "distribute-y",
    input: "把选中的节点竖向分布",
    nodes: three,
    selected: ["a", "b", "c"],
    expect: { kind: "plan", ops: ["distribute"] },
  },
  {
    id: "group",
    input: "把它们合并成一个分组",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "plan", ops: ["group"] },
  },
  {
    id: "ungroup",
    input: "取消分组",
    nodes: [groupNode("g1", "分组")],
    selected: ["g1"],
    expect: { kind: "plan", ops: ["ungroup"] },
  },
  {
    id: "delete-empty",
    input: "删除空文本节点",
    nodes: [textNode("a"), textNode("b", "有内容")],
    selected: [],
    expect: { kind: "plan", ops: ["delete"] },
  },
  {
    id: "delete-selected",
    input: "把它们删掉",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "plan", ops: ["delete"] },
  },
  {
    id: "add-two",
    input: "新建2个文本节点",
    nodes: [],
    selected: [],
    expect: { kind: "plan", ops: ["addNode", "addNode"] },
  },
  {
    id: "add-title",
    input: "加一个标题节点",
    nodes: three,
    selected: ["a"],
    expect: { kind: "plan", ops: ["addNode"] },
  },
  {
    id: "connect",
    input: "把选中的节点连接起来",
    nodes: three,
    selected: ["a", "b", "c"],
    expect: { kind: "plan", ops: ["connect", "connect"] },
  },
  {
    id: "kanban",
    input: "新建一个三列看板",
    nodes: [],
    selected: [],
    expect: { kind: "plan", ops: ["template"] },
  },
  {
    id: "auto-layout",
    input: "帮我自动布局",
    nodes: three,
    selected: [],
    expect: { kind: "plan", ops: ["autoLayout"] },
  },
  {
    id: "select-all",
    input: "全选",
    nodes: three,
    selected: [],
    expect: { kind: "plan", ops: ["select"] },
  },
  {
    id: "find-empty",
    input: "找到所有空文本节点并选中",
    nodes: [textNode("a"), textNode("b", "x")],
    selected: [],
    expect: { kind: "plan", ops: ["focus", "select"] },
  },
  {
    id: "query-empty-count",
    input: "这个画布现在有几个空文本节点？",
    nodes: [textNode("a"), textNode("b", "x")],
    selected: [],
    expect: { kind: "reply", messageIncludes: "1" },
  },
  {
    id: "query-group-content",
    input: "这个分组里有什么？",
    nodes: [groupNode("g1"), textNode("a", "", "g1")],
    selected: ["g1"],
    expect: { kind: "reply", messageIncludes: "1" },
  },
  {
    id: "query-summary",
    input: "画布现在有多少个节点？",
    nodes: [textNode("a"), textNode("b")],
    selected: [],
    expect: { kind: "reply", messageIncludes: "2" },
  },
  {
    id: "clarify-delete",
    input: "把它们删掉",
    nodes: three,
    selected: [],
    expect: { kind: "clarify" },
  },
  {
    id: "clarify-align",
    input: "把选中的节点对齐",
    nodes: three,
    selected: [],
    expect: { kind: "clarify" },
  },
  {
    id: "clarify-distribute",
    input: "把选中的节点分布开",
    nodes: three,
    selected: ["a", "b"],
    expect: { kind: "clarify" },
  },
  {
    id: "clarify-group",
    input: "帮它们分组",
    nodes: three,
    selected: ["a"],
    expect: { kind: "clarify" },
  },
  {
    id: "clarify-connect",
    input: "连接一下",
    nodes: three,
    selected: [],
    expect: { kind: "clarify" },
  },
  {
    id: "unrelated",
    input: "今天天气怎么样？",
    nodes: three,
    selected: [],
    expect: { kind: "reply" },
  },
];
