import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";
import { useCanvasStore } from "../store/canvasStore";
import { useUiStore } from "../store/uiStore";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const showMiniMap = useUiStore((state) => state.showMiniMap);
  const toggleMiniMap = useUiStore((state) => state.toggleMiniMap);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const toggleSnap = useUiStore((state) => state.toggleSnap);
  const autoLayout = useCanvasStore((state) => state.autoLayout);
  const hasNodes = useCanvasStore((state) => state.nodes.length > 0);
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

  const handleLayout = () => {
    void autoLayout().then(() => {
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
    });
  };

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
                {active ? <Icon name="check" size={12} /> : null}
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
            <Icon name="fullscreen" size={12} />
          </Button>
        </div>
      ) : null}
      <div className="canvas-control-group">
        <Button variant="ghost" size="sm" icon onClick={() => zoomOut({ duration: 200 })} title="缩小" aria-label="缩小">
          <Icon name="zoom-out" size={15} />
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
          <Icon name="zoom-in" size={15} />
        </Button>
        <span className="canvas-divider" />
        <Button
          variant="ghost"
          size="sm"
          icon
          onClick={handleLayout}
          disabled={!hasNodes}
          title="自动布局（Ctrl/Cmd + L）"
          aria-label="自动布局"
        >
          <Icon name="layout" size={15} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon
          className={snapToGrid ? "is-on" : undefined}
          onClick={toggleSnap}
          title={`网格吸附：${snapToGrid ? "开" : "关"}`}
          aria-label={snapToGrid ? "关闭网格吸附" : "开启网格吸附"}
          aria-pressed={snapToGrid}
        >
          <Icon name="magnet" size={15} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon
          onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 })}
          title="适应视图"
          aria-label="适应视图"
        >
          <Icon name="fit" size={15} />
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
          <Icon name="map" size={15} />
        </Button>
      </div>
    </div>
  );
}
