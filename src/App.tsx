import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "./components/FlowCanvas";
import { ensureInlineImagesMigrated, pruneOrphanImages } from "./lib/imageMigration";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { ToastHost } from "./components/ToastHost";
import { Toolbar } from "./components/Toolbar";
import { useAutoSave } from "./hooks/useAutoSave";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";

function App() {
  useAutoSave();
  useCanvasShortcuts();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("bench")) return;
    void ensureInlineImagesMigrated()
      .then(() => pruneOrphanImages())
      .catch(() => {
        // IndexedDB 不可用时继续使用 localStorage。
      });
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ◈
            </span>
            <div className="brand-copy">
              <h1>Infinite Canvas</h1>
              <p>React Flow · Zustand · local-first</p>
            </div>
          </div>
          <Toolbar />
        </header>
        <FlowCanvas />
        <KeyboardHelp />
        <ToastHost />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
