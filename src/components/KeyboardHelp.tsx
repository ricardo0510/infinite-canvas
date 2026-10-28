import { useEffect } from "react";
import { useUiStore } from "../store/uiStore";

const GROUPS: { title: string; items: { keys: string[]; action: string }[] }[] = [
  {
    title: "Editing",
    items: [
      { keys: ["Ctrl/Cmd + Z"], action: "Undo" },
      { keys: ["Ctrl/Cmd + Shift + Z"], action: "Redo" },
      { keys: ["Ctrl/Cmd + C", "Ctrl/Cmd + V"], action: "Copy / paste" },
      { keys: ["Ctrl/Cmd + D"], action: "Duplicate" },
      { keys: ["Delete", "Backspace"], action: "Delete selection" },
      { keys: ["Ctrl/Cmd + A"], action: "Select all" },
      { keys: ["Ctrl/Cmd + E"], action: "Export JSON" },
      { keys: ["Ctrl/Cmd + S"], action: "Save to localStorage" },
    ],
  },
  {
    title: "Arrange",
    items: [
      { keys: ["Ctrl/Cmd + G"], action: "Group selection" },
      { keys: ["Ctrl/Cmd + Shift + G"], action: "Ungroup" },
      { keys: ["Ctrl/Cmd + L"], action: "Auto layout" },
      { keys: ["Arrow keys"], action: "Nudge 1px (Shift: 10px)" },
      { keys: ["F"], action: "Focus selection" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: ["Double-click"], action: "Add a note" },
      { keys: ["Right-click"], action: "Context menu" },
      { keys: ["Middle/right drag"], action: "Pan" },
      { keys: ["Left drag"], action: "Box select" },
      { keys: ["Shift/Ctrl + click"], action: "Add to selection" },
      { keys: ["Ctrl/Cmd + 0"], action: "Fit view" },
      { keys: ["?"], action: "This panel" },
      { keys: ["Esc"], action: "Clear selection / close panels" },
    ],
  },
];

export function KeyboardHelp() {
  const open = useUiStore((state) => state.helpOpen);
  const setOpen = useUiStore((state) => state.setHelpOpen);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        Boolean(target.closest("input, textarea, [contenteditable='true']"));
      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (!editable && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        setOpen(!useUiStore.getState().helpOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onPointerDown={() => setOpen(false)}>
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="help-head">
          <h2 id="help-title">Keyboard shortcuts</h2>
          <button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div className="help-grid">
          {GROUPS.map((group) => (
            <section key={group.title} className="help-group">
              <h3>{group.title}</h3>
              <dl>
                {group.items.map((item) => (
                  <div key={item.action} className="help-row">
                    <dt>
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dt>
                    <dd>{item.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
