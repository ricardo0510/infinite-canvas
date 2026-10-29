import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useCanvasStore } from "../../store/canvasStore";

type NodeTitleBarProps = {
  id: string;
  title: string;
  defaultTitle: string;
};

export function NodeTitleBar({ id, title, defaultTitle }: NodeTitleBarProps) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (event: MouseEvent) => {
    event.stopPropagation();
    setDraft(title || defaultTitle);
    setEditing(true);
    window.requestAnimationFrame(() => inputRef.current?.select());
  };

  const finishEditing = () => {
    const next = draft.trim() || defaultTitle;
    if (next !== title) {
      commit();
      updateNodeData(id, { title: next });
    }
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishEditing();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  };

  return (
    <div className="node-head">
      <span className="node-dot" aria-hidden="true" />
      {editing ? (
        <input
          ref={inputRef}
          className="nodrag node-title-input"
          value={draft}
          aria-label="Node title"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={onKeyDown}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <span className="node-title" onDoubleClick={startEditing} title="Double-click to rename">
          {title || defaultTitle}
        </span>
      )}
    </div>
  );
}
