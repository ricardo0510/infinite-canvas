import { useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { exportSnapshot } from "../lib/storage";
import { TEMPLATES } from "../lib/templates";
import { useCanvasStore } from "../store/canvasStore";
import { useUiStore } from "../store/uiStore";
import type { NodeKind } from "../types";

type Command = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen);
  // Mount a fresh session on every open so the query and active row reset
  // without deriving state in an effect.
  if (!open) return null;
  return <CommandPaletteSession />;
}

function CommandPaletteSession() {
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const showMiniMap = useUiStore((state) => state.showMiniMap);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const state = () => useCanvasStore.getState();
    const ui = () => useUiStore.getState();
    const center = () => {
      const rect = document.querySelector<HTMLElement>(".canvas")?.getBoundingClientRect();
      return screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? window.innerHeight) / 2,
      });
    };
    const add = (kind: NodeKind) => () => state().addNode(kind, center());
    const template = (templateId: string) => () => {
      const ids = state().insertTemplate(templateId, center());
      window.setTimeout(() => {
        fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.3,
          duration: 300,
          maxZoom: 1.25,
        });
      }, 0);
    };
    const fit = () => fitView({ padding: 0.2, duration: 300, maxZoom: 1.25 });
    const layout = () => {
      void state().autoLayout().then(() => window.setTimeout(fit, 0));
    };

    return [
      { id: "text", label: "New text", group: "Add", keywords: "label", run: add("text") },
      { id: "image", label: "New image", group: "Add", keywords: "picture upload", run: add("image") },
      { id: "video", label: "New video", group: "Add", keywords: "movie clip generate", run: add("video") },
      { id: "group", label: "New group", group: "Add", keywords: "container", run: add("group") },
      ...TEMPLATES.map((item) => ({
        id: `template-${item.id}`,
        label: `Template: ${item.label}`,
        group: "Templates",
        keywords: item.description,
        run: template(item.id),
      })),
      { id: "undo", label: "Undo", group: "Edit", hint: "Ctrl/Cmd Z", run: () => state().undo() },
      {
        id: "redo",
        label: "Redo",
        group: "Edit",
        hint: "Ctrl/Cmd Shift Z",
        run: () => state().redo(),
      },
      {
        id: "select-all",
        label: "Select all",
        group: "Edit",
        hint: "Ctrl/Cmd A",
        run: () => state().selectAll(),
      },
      {
        id: "duplicate",
        label: "Duplicate selection",
        group: "Edit",
        hint: "Ctrl/Cmd D",
        run: () => state().duplicateSelected(),
      },
      {
        id: "delete",
        label: "Delete selection",
        group: "Edit",
        hint: "Del",
        run: () => state().removeSelected(),
      },
      {
        id: "group-selection",
        label: "Group selection",
        group: "Arrange",
        hint: "Ctrl/Cmd G",
        run: () => state().groupSelected(),
      },
      {
        id: "ungroup-selection",
        label: "Ungroup selection",
        group: "Arrange",
        hint: "Ctrl/Cmd Shift G",
        run: () => state().ungroupSelected(),
      },
      {
        id: "layout",
        label: "Auto layout",
        group: "Arrange",
        hint: "Ctrl/Cmd L",
        run: layout,
      },
      { id: "fit", label: "Fit view", group: "View", hint: "Ctrl/Cmd 0", run: fit },
      {
        id: "snap",
        label: snapToGrid ? "Turn grid snap off" : "Turn grid snap on",
        group: "View",
        run: () => ui().toggleSnap(),
      },
      {
        id: "minimap",
        label: showMiniMap ? "Hide minimap" : "Show minimap",
        group: "View",
        run: () => ui().toggleMiniMap(),
      },
      {
        id: "export",
        label: "Export JSON",
        group: "Canvas",
        hint: "Ctrl/Cmd E",
        run: () => {
          void exportSnapshot(state().getSnapshot());
        },
      },
      {
        id: "clear",
        label: "Clear canvas",
        group: "Canvas",
        keywords: "delete all reset",
        run: () => {
          if (state().nodes.length === 0) return;
          if (window.confirm("Clear the canvas? This can be undone.")) state().clear();
        },
      },
    ];
  }, [fitView, screenToFlowPosition, snapToGrid, showMiniMap]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.keywords ?? ""}`.toLowerCase().includes(value),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (filtered.length ? (index + 1) % filtered.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) =>
          filtered.length ? (index - 1 + filtered.length) % filtered.length : 0,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const command = filtered[active];
        if (command) {
          setOpen(false);
          command.run();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [filtered, active, setOpen]);

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    element?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";

  return (
    <div className="command-backdrop" onPointerDown={() => setOpen(false)}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          className="command-input"
          value={query}
          placeholder="Search commands and templates…"
          aria-label="Command search"
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
        />
        <div className="command-list" ref={listRef}>
          {filtered.length === 0 ? (
            <p className="command-empty">No matching commands.</p>
          ) : (
            filtered.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const isActive = index === active;
              return (
                <div key={command.id}>
                  {showGroup ? <div className="command-group-label">{command.group}</div> : null}
                  <button
                    type="button"
                    className={`command-item${isActive ? " is-active" : ""}`}
                    data-active={isActive ? "true" : "false"}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      setOpen(false);
                      command.run();
                    }}
                  >
                    <span className="command-item-label">{command.label}</span>
                    {command.hint ? <kbd>{command.hint}</kbd> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="command-footer">
          <span>↑↓ navigate</span>
          <span>Enter run</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
