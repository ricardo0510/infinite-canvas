import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "../lib/geometry";
import { storeImage } from "../lib/imageStore";
import { readImageFile, type LoadedImage } from "../lib/images";
import { isEditableTarget } from "../lib/dom";
import { useCanvasStore } from "../store/canvasStore";
import { useToastStore } from "../store/toastStore";

export type ImageDropPoint = { x: number; y: number };

const IGNORED_DROP_TARGETS =
  ".canvas-controls, .statusbar, .selection-toolbar, .edge-toolbar, .context-menu, .command-backdrop, .modal-backdrop, .react-flow__panel";

export function useImageDrop() {
  const { screenToFlowPosition } = useReactFlow();
  const [dragOver, setDragOver] = useState(false);
  const mouseRef = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const importImages = useCallback(
    async (files: File[], point: ImageDropPoint) => {
      if (files.length === 0) return;
      const selected = files.slice(0, 12);
      const results = await Promise.allSettled(selected.map(readImageFile));
      const loaded = results
        .filter((result): result is PromiseFulfilledResult<LoadedImage> => result.status === "fulfilled")
        .map((result) => result.value);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const toast = useToastStore.getState().push;

      if (loaded.length === 0) {
        toast(
          rejected?.reason instanceof Error
            ? rejected.reason.message
            : "没有可读取的图片。",
          "error",
        );
        return;
      }

      const origin = screenToFlowPosition(point);
      const refs = await Promise.all(loaded.map((image) => storeImage(image.blob)));
      const specs = loaded.map((image, index) => {
        const size = {
          width: AI_NODE_WIDTH,
          height: mediaNodeHeight(AI_NODE_WIDTH, image.width, image.height),
        };
        const single = loaded.length === 1;
        const stepX = AI_NODE_WIDTH + 64;
        const stepY = 240;
        return {
          position: {
            x: single ? origin.x - size.width / 2 : origin.x + (index % 3) * stepX,
            y: single ? origin.y - size.height / 2 : origin.y + Math.floor(index / 3) * stepY,
          },
          src: refs[index],
          width: image.width,
          height: image.height,
          alt: image.name,
        };
      });

      useCanvasStore.getState().addImages(specs);
      if (loaded.length > 1) toast(`已添加 ${loaded.length} 张图片。`, "success");
      if (rejected) {
        toast(
          rejected.reason instanceof Error ? rejected.reason.message : "部分文件已跳过。",
          "error",
        );
      }
      if (files.length > selected.length) {
        toast(`只添加了前 ${selected.length} 张图片。`, "info");
      }
    },
    [screenToFlowPosition],
  );

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const files: File[] = [];
      const items = event.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length === 0 && event.clipboardData?.files?.length) {
        for (const file of Array.from(event.clipboardData.files)) {
          if (file.type.startsWith("image/")) files.push(file);
        }
      }
      if (files.length === 0) return;
      event.preventDefault();
      void importImages(files, mouseRef.current);
    };
    const clearDragOver = () => setDragOver(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", clearDragOver);
    window.addEventListener("dragend", clearDragOver);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drop", clearDragOver);
      window.removeEventListener("dragend", clearDragOver);
    };
  }, [importImages]);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const target = event.target as HTMLElement | null;
    if (target?.closest(IGNORED_DROP_TARGETS)) {
      setDragOver(false);
      return;
    }
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragOver(false);
      const target = event.target as HTMLElement | null;
      if (target?.closest(IGNORED_DROP_TARGETS)) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) {
        useToastStore.getState().push("拖入图片文件即可添加到画布。", "error");
        return;
      }
      void importImages(images, { x: event.clientX, y: event.clientY });
    },
    [importImages],
  );

  return { dragOver, handleDragOver, handleDragLeave, handleDrop };
}
