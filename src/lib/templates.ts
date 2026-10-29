import type { NodeKind, NoteColor } from "../types";
import { AI_NODE_WIDTH, EMPTY_NODE_HEIGHT } from "./geometry";

export type TemplateNode = {
  kind: NodeKind;
  x: number;
  y: number;
  width?: number;
  height?: number;
  data: Record<string, unknown>;
};

export type TemplateEdge = {
  from: number;
  to: number;
};

export type CanvasTemplate = {
  id: string;
  label: string;
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

function textNode(
  title: string,
  text: string,
  color: NoteColor,
  x: number,
  y: number,
  height = EMPTY_NODE_HEIGHT,
): TemplateNode {
  return {
    kind: "text",
    x,
    y,
    width: AI_NODE_WIDTH,
    height,
    data: { title, text, color, fontSize: 14 },
  };
}

export const TEMPLATES: CanvasTemplate[] = [
  {
    id: "flowchart",
    label: "流程图",
    description: "开始 → 处理 → 审核 → 发布",
    nodes: [
      textNode("开始", "触发条件或需求", "violet", 0, 0),
      textNode("收集信息", "我们需要哪些输入？", "cyan", 0, 190),
      textNode("审核", "检查边界情况并确认", "amber", 0, 380),
      textNode("发布", "上线并通知", "emerald", 0, 570),
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ],
  },
  {
    id: "mindmap",
    label: "思维导图",
    description: "一个中心想法与四个分支",
    nodes: [
      textNode("中心想法", "我们要探索什么？", "violet", 340, 300),
      textNode("分支 A", "第一个方向", "emerald", 40, 40),
      textNode("分支 B", "第二个方向", "cyan", 700, 40),
      textNode("分支 C", "第三个方向", "amber", 40, 560),
      textNode("分支 D", "第四个方向", "emerald", 700, 560),
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 0, to: 3 },
      { from: 0, to: 4 },
    ],
  },
  {
    id: "kanban",
    label: "看板",
    description: "待办 / 进行中 / 已完成",
    nodes: [
      textNode("待办", "- 整理想法\n- 收集资料", "violet", 0, 0, 300),
      textNode("进行中", "- 编写大纲", "amber", 320, 0, 300),
      textNode("已完成", "- 确定标题\n- 创建画布", "emerald", 640, 0, 300),
    ],
    edges: [],
  },
  {
    id: "meeting",
    label: "会议记录",
    description: "参会人、议程、决策、行动项",
    nodes: [
      textNode("参会人", "- 我\n- 访客", "violet", 0, 0),
      textNode("议程", "- 议题一\n- 议题二", "cyan", 320, 0),
      textNode("决策", "- 决策一", "amber", 0, 190),
      textNode("行动项", "- 负责人 + 截止时间", "emerald", 320, 190),
    ],
    edges: [],
  },
];

export const TEMPLATE_MAP: Record<string, CanvasTemplate> = Object.fromEntries(
  TEMPLATES.map((template) => [template.id, template]),
);
