import { NodeResizer, type NodeProps } from "@xyflow/react";
import { memo, useRef, type CSSProperties } from "react";
import { MIN_SIZE } from "../../lib/geometry";
import { NOTE_COLORS, useCanvasStore } from "../../store/canvasStore";
import type { GroupNodeModel } from "../../types";
import { NodeColors } from "./NodeColors";
import { nodePropsEqual } from "./nodePropsEqual";

function GroupNodeImpl({ id, data, selected }: NodeProps<GroupNodeModel>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const commit = useCanvasStore((state) => state.commit);
  const editing = useRef(false);
  const accent = NOTE_COLORS[data.color] ?? NOTE_COLORS.amber;

  return (
    <div
      className={`group-node${selected ? " is-selected" : ""}`}
      style={{ "--node-accent": accent } as CSSProperties}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_SIZE.group.width}
        minHeight={MIN_SIZE.group.height}
        onResizeStart={() => commit()}
      />
      <div className="group-head">
        <span className="node-dot" />
        <input
          className="nodrag group-label"
          value={data.label}
          placeholder="分组"
          aria-label="分组名称"
          onFocus={() => {
            editing.current = false;
          }}
          onChange={(event) => {
            if (!editing.current) {
              commit();
              editing.current = true;
            }
            updateNodeData(id, { label: event.target.value });
          }}
        />
        <NodeColors
          value={data.color}
          onChange={(color) => {
            commit();
            updateNodeData(id, { color });
          }}
        />
      </div>
      <div className="group-body" />
    </div>
  );
}


export const GroupNode = memo(GroupNodeImpl, nodePropsEqual);
