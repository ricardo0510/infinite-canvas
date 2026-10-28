import type { Edge, Node } from "@xyflow/react";

export type NoteColor = "violet" | "cyan" | "amber" | "emerald";

export type NodeKind = "note" | "text" | "image" | "group";

export type NoteData = {
  title: string;
  body: string;
  color: NoteColor;
  [key: string]: unknown;
};

export type TextData = {
  text: string;
  color: NoteColor;
  fontSize: number;
  [key: string]: unknown;
};

export type ImageData = {
  src: string;
  alt: string;
  [key: string]: unknown;
};

export type GroupData = {
  label: string;
  color: NoteColor;
  [key: string]: unknown;
};

export type NoteNodeModel = Node<NoteData, "note">;
export type TextNodeModel = Node<TextData, "text">;
export type ImageNodeModel = Node<ImageData, "image">;
export type GroupNodeModel = Node<GroupData, "group">;

export type CanvasNode = NoteNodeModel | TextNodeModel | ImageNodeModel | GroupNodeModel;

export type CanvasEdge = Edge;

export type CanvasSnapshot = {
  version: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export type AlignKind = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
export type DistributeAxis = "x" | "y";
