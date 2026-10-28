import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { useUiStore } from "../store/uiStore";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const showMiniMap = useUiStore((state) => state.showMiniMap);
  const toggleMiniMap = useUiStore((state) => state.toggleMiniMap);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        <div className="zoom-menu" role="menu" aria-label="Zoom presets">
          {ZOOM_PRESETS.map((preset) => {
            const active = Math.abs(zoom - preset) < 0.01;
            return (
              <button
                key={preset}
                type="button"
                role="menuitem"
                className={`zoom-menu-item${active ? " is-current" : ""}`}
                onClick={() => {
                  zoomTo(preset, { duration: 200 });
                  setOpen(false);
                }}
              >
                <span>{Math.round(preset * 100)}%</span>
                {active ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            className="zoom-menu-item"
            onClick={() => {
              fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 });
              setOpen(false);
            }}
          >
            <span>Fit view</span>
            <span aria-hidden="true">⛶</span>
          </button>
        </div>
      ) : null}
      <div className="canvas-control-group">
        <button type="button" className="canvas-button" onClick={() => zoomOut({ duration: 200 })} title="Zoom out" aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="canvas-button canvas-zoom-value"
          onClick={() => setOpen((value) => !value)}
          title="Zoom presets"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {percent}%
        </button>
        <button type="button" className="canvas-button" onClick={() => zoomIn({ duration: 200 })} title="Zoom in" aria-label="Zoom in">
          +
        </button>
        <span className="canvas-divider" />
        <button
          type="button"
          className="canvas-button"
          onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 })}
          title="Fit view"
          aria-label="Fit view"
        >
          ⛶
        </button>
        <button
          type="button"
          className={`canvas-button${showMiniMap ? " is-on" : ""}`}
          onClick={toggleMiniMap}
          title={showMiniMap ? "Hide minimap" : "Show minimap"}
          aria-label={showMiniMap ? "Hide minimap" : "Show minimap"}
          aria-pressed={showMiniMap}
        >
          ▦
        </button>
      </div>
    </div>
  );
}
