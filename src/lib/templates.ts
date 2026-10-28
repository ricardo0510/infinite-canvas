import type { NodeKind } from "../types";

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

export const TEMPLATES: CanvasTemplate[] = [
  {
    id: "flowchart",
    label: "Flowchart",
    description: "Start → process → review → ship",
    nodes: [
      {
        kind: "note",
        x: 0,
        y: 0,
        width: 240,
        height: 120,
        data: { title: "Start", body: "Trigger or request", color: "violet" },
      },
      {
        kind: "note",
        x: 0,
        y: 190,
        width: 240,
        height: 140,
        data: { title: "Collect inputs", body: "What do we need?", color: "cyan" },
      },
      {
        kind: "note",
        x: 0,
        y: 400,
        width: 240,
        height: 140,
        data: { title: "Review", body: "Check edge cases and sign off", color: "amber" },
      },
      {
        kind: "note",
        x: 0,
        y: 610,
        width: 240,
        height: 120,
        data: { title: "Ship it", body: "Release and announce", color: "emerald" },
      },
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
      {
        kind: "note",
        x: 340,
        y: 300,
        width: 240,
        height: 120,
        data: { title: "Central idea", body: "What are we exploring?", color: "violet" },
      },
      {
        kind: "text",
        x: 40,
        y: 40,
        width: 220,
        height: 90,
        data: { text: "Branch A", color: "emerald", fontSize: 16 },
      },
      {
        kind: "text",
        x: 700,
        y: 40,
        width: 220,
        height: 90,
        data: { text: "Branch B", color: "cyan", fontSize: 16 },
      },
      {
        kind: "text",
        x: 40,
        y: 610,
        width: 220,
        height: 90,
        data: { text: "Branch C", color: "amber", fontSize: 16 },
      },
      {
        kind: "text",
        x: 700,
        y: 610,
        width: 220,
        height: 90,
        data: { text: "Branch D", color: "emerald", fontSize: 16 },
      },
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
      {
        kind: "note",
        x: 0,
        y: 0,
        width: 260,
        height: 320,
        data: { title: "To do", body: "- Draft the idea\n- Collect links", color: "violet" },
      },
      {
        kind: "note",
        x: 300,
        y: 0,
        width: 260,
        height: 320,
        data: { title: "Doing", body: "- Write the outline", color: "amber" },
      },
      {
        kind: "note",
        x: 600,
        y: 0,
        width: 260,
        height: 320,
        data: { title: "Done", body: "- Pick a title\n- Create the canvas", color: "emerald" },
      },
    ],
    edges: [],
  },
  {
    id: "meeting",
    label: "Meeting notes",
    description: "Attendees, agenda, decisions, actions",
    nodes: [
      {
        kind: "note",
        x: 0,
        y: 0,
        width: 260,
        height: 190,
        data: { title: "Attendees", body: "- You\n- …", color: "violet" },
      },
      {
        kind: "note",
        x: 300,
        y: 0,
        width: 260,
        height: 190,
        data: { title: "Agenda", body: "- Topic one\n- Topic two", color: "cyan" },
      },
      {
        kind: "note",
        x: 0,
        y: 230,
        width: 260,
        height: 190,
        data: { title: "Decisions", body: "- Decision one", color: "amber" },
      },
      {
        kind: "note",
        x: 300,
        y: 230,
        width: 260,
        height: 190,
        data: { title: "Action items", body: "- Owner + due date", color: "emerald" },
      },
    ],
    edges: [],
  },
];

export const TEMPLATE_MAP: Record<string, CanvasTemplate> = Object.fromEntries(
  TEMPLATES.map((template) => [template.id, template]),
);
