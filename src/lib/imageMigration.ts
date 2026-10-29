import { useCanvasStore } from "../store/canvasStore";
import { isIdbImageRef, pruneImages, putImage } from "./imageStore";

async function migrateInlineImages(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;

  const targets = useCanvasStore
    .getState()
    .nodes.filter(
      (node) =>
        node.type === "image" &&
        typeof node.data.src === "string" &&
        node.data.src.startsWith("data:image/"),
    );
  if (targets.length === 0) return 0;

  const updates = new Map<string, string>();
  for (const node of targets) {
    try {
      const response = await fetch(node.data.src as string);
      const blob = await response.blob();
      const id = await putImage(blob);
      updates.set(node.id, `idb:${id}`);
    } catch {
      // Keep the inline data URL if this image cannot be moved.
    }
  }

  if (updates.size > 0) useCanvasStore.getState().replaceImageSources(updates);
  return updates.size;
}

let migrationPromise: Promise<number> | null = null;

/** Runs once per page load so StrictMode double effects do not duplicate blobs. */
export function ensureInlineImagesMigrated(): Promise<number> {
  if (!migrationPromise) migrationPromise = migrateInlineImages();
  return migrationPromise;
}

/** Re-runs after importing a snapshot that still contains data URL images. */
export function migrateInlineImagesNow(): Promise<number> {
  return migrateInlineImages();
}

/** Removes stored blobs that the current canvas no longer references. */
export async function pruneOrphanImages(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const refs: string[] = [];
  for (const node of useCanvasStore.getState().nodes) {
    if (node.type === "image" && isIdbImageRef(node.data.src)) refs.push(node.data.src);
    if (node.type === "video") {
      if (isIdbImageRef(node.data.src)) refs.push(node.data.src);
      if (isIdbImageRef(node.data.thumbnailUrl)) refs.push(node.data.thumbnailUrl);
    }
  }
  return pruneImages(refs);
}
