import { lazy, Suspense, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "./components/FlowCanvas";
import { ensureInlineImagesMigrated, pruneOrphanImages } from "./lib/imageMigration";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { StatusBar } from "./components/StatusBar";
import { ToastHost } from "./components/ToastHost";
import { Toolbar } from "./components/Toolbar";
import { useAutoSave } from "./hooks/useAutoSave";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useUiStore } from "./store/uiStore";

const AiSettingsDialog = lazy(async () => {
  const module = await import("./components/ai/AiSettingsDialog");
  return { default: module.AiSettingsDialog };
});

function App() {
  const aiSettingsOpen = useUiStore((state) => state.aiSettingsOpen);
  useAutoSave();
  useCanvasShortcuts();

  useEffect(() => {
    void import("./lib/ai/controller").then((module) => module.initAiController());
  }, []);

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
        <div className="brand-dock">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ✦
            </span>
            <div className="brand-copy">
              <h1>无限画布</h1>
              <p>React Flow · Zustand · 本地优先</p>
            </div>
          </div>
        </div>
        <FlowCanvas />
        <div className="bottom-dock">
          <StatusBar />
          <Toolbar />
        </div>
        {aiSettingsOpen ? (
          <Suspense fallback={null}>
            <AiSettingsDialog />
          </Suspense>
        ) : null}
        <KeyboardHelp />
        <ToastHost />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
