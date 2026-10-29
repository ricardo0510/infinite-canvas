import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { isEditableTarget } from "../lib/dom";
import { useCanvasStore } from "../store/canvasStore";

/** 画布级快捷键：适应视图、聚焦选中节点，并拦截浏览器页面缩放。 */
export function useCanvasKeys() {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "0") {
        event.preventDefault();
        fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 });
        return;
      }
      if (!mod && !event.shiftKey && event.key.toLowerCase() === "f") {
        const selected = useCanvasStore.getState().nodes.filter((node) => node.selected);
        if (selected.length === 0) return;
        event.preventDefault();
        fitView({
          nodes: selected.map((node) => ({ id: node.id })),
          padding: 0.4,
          duration: 300,
          maxZoom: 1.25,
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitView]);

  useEffect(() => {
    // Keep browser page zoom out of the way; the canvas handles its own zoom.
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const zoomKeys = new Set(["+", "=", "-", "_", "0"]);
    const handleZoomKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && zoomKeys.has(event.key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleZoomKeyDown);
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleZoomKeyDown);
    };
  }, []);
}
