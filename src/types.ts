import type { Edge, Node } from "@xyflow/react";

export type NoteColor = "violet" | "cyan" | "amber" | "emerald";

export type NoteData = {
  title: string;
  body: string;
  color: NoteColor;
  [key: string]: unknown;
};

export type CanvasNode = Node<NoteData, "note">;

export type CanvasEdge = Edge;

export type CanvasSnapshot = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};
