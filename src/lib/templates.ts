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
    label: "Flowchart",
    description: "Start → process → review → ship",
    nodes: [
      textNode("Start", "Trigger or request", "violet", 0, 0),
      textNode("Collect inputs", "What do we need?", "cyan", 0, 190),
      textNode("Review", "Check edge cases and sign off", "amber", 0, 380),
      textNode("Ship it", "Release and announce", "emerald", 0, 570),
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ],
  },
  {
    id: "mindmap",
    label: "Mind map",
    description: "One central idea with four branches",
    nodes: [
      textNode("Central idea", "What are we exploring?", "violet", 340, 300),
      textNode("Branch A", "First direction", "emerald", 40, 40),
      textNode("Branch B", "Second direction", "cyan", 700, 40),
      textNode("Branch C", "Third direction", "amber", 40, 560),
      textNode("Branch D", "Fourth direction", "emerald", 700, 560),
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
    label: "Kanban",
    description: "To do / doing / done columns",
    nodes: [
      textNode("To do", "- Draft the idea\n- Collect links", "violet", 0, 0, 300),
      textNode("Doing", "- Write the outline", "amber", 320, 0, 300),
      textNode("Done", "- Pick a title\n- Create the canvas", "emerald", 640, 0, 300),
    ],
    edges: [],
  },
  {
    id: "meeting",
    label: "Meeting notes",
    description: "Attendees, agenda, decisions, actions",
    nodes: [
      textNode("Attendees", "- You\n- Guest", "violet", 0, 0),
      textNode("Agenda", "- Topic one\n- Topic two", "cyan", 320, 0),
      textNode("Decisions", "- Decision one", "amber", 0, 190),
      textNode("Action items", "- Owner + due date", "emerald", 320, 190),
    ],
    edges: [],
  },
];

export const TEMPLATE_MAP: Record<string, CanvasTemplate> = Object.fromEntries(
  TEMPLATES.map((template) => [template.id, template]),
);
