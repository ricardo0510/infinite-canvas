import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";
import { useUiStore } from "../store/uiStore";
import { Button } from "./ui/Button";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const showMiniMap = useUiStore((state) => state.showMiniMap);
  const toggleMiniMap = useUiStore((state) => state.toggleMiniMap);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuKeyboard(menuRef, open);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const percent = Math.round(zoom * 100);

  return (
    <div ref={rootRef} className="canvas-controls">
      {open ? (
        <div ref={menuRef} id="zoom-menu" className="zoom-menu" role="menu" aria-label="缩放比例">
          {ZOOM_PRESETS.map((preset) => {
            const active = Math.abs(zoom - preset) < 0.01;
            return (
              <Button
                key={preset}
                variant="menu"
                size="sm"
                block
                role="menuitem"
                className={active ? "is-current" : undefined}
                onClick={() => {
                  zoomTo(preset, { duration: 200 });
                  setOpen(false);
                }}
              >
                <span>{Math.round(preset * 100)}%</span>
                {active ? <span aria-hidden="true">✓</span> : null}
              </Button>
            );
          })}
          <Button
            variant="menu"
            size="sm"
            block
            role="menuitem"
            onClick={() => {
              fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 });
              setOpen(false);
            }}
          >
            <span>适应视图</span>
            <span aria-hidden="true">⛶</span>
          </Button>
        </div>
      ) : null}
      <div className="canvas-control-group">
        <Button variant="ghost" size="sm" icon onClick={() => zoomOut({ duration: 200 })} title="缩小" aria-label="缩小">
          −
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="canvas-zoom-value"
          onClick={() => setOpen((value) => !value)}
          title="缩放比例"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="zoom-menu"
        >
          {percent}%
        </Button>
        <Button variant="ghost" size="sm" icon onClick={() => zoomIn({ duration: 200 })} title="放大" aria-label="放大">
          +
        </Button>
        <span className="canvas-divider" />
        <Button
          variant="ghost"
          size="sm"
          icon
          onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 })}
          title="适应视图"
          aria-label="适应视图"
        >
          ⛶
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon
          className={showMiniMap ? "is-on" : undefined}
          onClick={toggleMiniMap}
          title={showMiniMap ? "隐藏小地图" : "显示小地图"}
          aria-label={showMiniMap ? "隐藏小地图" : "显示小地图"}
          aria-pressed={showMiniMap}
        >
          ▦
        </Button>
      </div>
    </div>
  );
}
