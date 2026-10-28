import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "./components/FlowCanvas";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { Toolbar } from "./components/Toolbar";
import { useAutoSave } from "./hooks/useAutoSave";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";

function App() {
  useAutoSave();
  useCanvasShortcuts();

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
      </div>
    </ReactFlowProvider>
  );
}

export default App;
