export type PasteAnchor = { x: number; y: number };

let anchor: PasteAnchor | null = null;

export function setPasteAnchor(point: PasteAnchor | null): void {
  anchor = point;
}

export function getPasteAnchor(): PasteAnchor | null {
  return anchor;
}
