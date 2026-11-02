import { memo, useCallback, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useResolvedImageSrc } from "../hooks/useResolvedImageSrc";
import { byId, nodeRect } from "../lib/geometry";
import { sanitizeImageSrc } from "../lib/storage";
import { useCanvasStore } from "../store/canvasStore";
import type { CanvasNode } from "../types";
import { Input } from "./ui/Control";
import { Icon } from "./ui/Icon";

function nodeTitle(node: CanvasNode): string {
  if (node.type === "group") return node.data.label || "分组";
  if (node.data.title) return node.data.title;
  if (node.type === "text") return "文本";
  return node.type === "image" ? "图片" : "视频";
}

function searchText(node: CanvasNode): string {
  const body =
    node.type === "text" ? node.data.text : node.type === "group" ? node.data.label : "";
  return `${nodeTitle(node)} ${body}`.toLowerCase();
}

function NodeThumb({ node }: { node: CanvasNode }) {
  const imageSrc = useResolvedImageSrc(
    node.type === "image"
      ? sanitizeImageSrc(node.data.src)
      : node.type === "video"
        ? sanitizeImageSrc(node.data.thumbnailUrl)
        : "",
  );
  const icon =
    node.type === "text"
      ? "file-text"
      : node.type === "video"
        ? "play"
        : node.type === "group"
          ? "group"
          : "image";

  return (
    <span className={`sidebar-thumb sidebar-thumb-${node.type}`}>
      {imageSrc ? (
        <img src={imageSrc} alt="" draggable={false} />
      ) : (
        <Icon name={icon} size={15} />
      )}
      {node.type === "video" && imageSrc ? (
        <span className="sidebar-thumb-play" aria-hidden="true">
          <Icon name="play" size={7} />
        </span>
      ) : null}
    </span>
  );
}

const SidebarItem = memo(function SidebarItem({
  node,
  onSelect,
}: {
  node: CanvasNode;
  onSelect: (node: CanvasNode) => void;
}) {
  const title = nodeTitle(node);
  return (
    <button
      type="button"
      className={`sidebar-item${node.selected ? " is-active" : ""}`}
      aria-pressed={node.selected === true}
      title={title}
      onClick={() => onSelect(node)}
    >
      <NodeThumb node={node} />
      <span className="sidebar-item-title">{title}</span>
    </button>
  );
});

export function CanvasSidebar() {
  const nodes = useCanvasStore((state) => state.nodes);
  const { setCenter, getZoom } = useReactFlow();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) => searchText(node).includes(needle));
  }, [nodes, query]);

  const focusNode = useCallback(
    (node: CanvasNode) => {
      const state = useCanvasStore.getState();
      const index = byId(state.nodes);
      const rect = nodeRect(node, index);
      state.clearSelection();
      state.selectNodes([node.id]);
      const zoom = Math.min(1.25, Math.max(0.6, getZoom()));
      void setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, {
        zoom,
        duration: 350,
      });
    },
    [getZoom, setCenter],
  );

  return (
    <aside className="canvas-sidebar" aria-label="画布元素">
      <div className="sidebar-brand">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="logo" size={18} />
          </span>
          <div className="brand-copy">
            <h1>无限画布</h1>
            <p>本地保存</p>
          </div>
        </div>
      </div>

      <div className="sidebar-head">
        <h2 className="sidebar-title">画布元素</h2>
        <span className="sidebar-count">{nodes.length}</span>
      </div>

      <label className="sidebar-search">
        <Icon name="command" size={14} />
        <Input
          variant="bare"
          controlSize="sm"
          value={query}
          placeholder="搜索元素"
          aria-label="搜索元素"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="sidebar-list">
        {filtered.length === 0 ? (
          <p className="sidebar-empty">{query.trim() ? "没有匹配的元素" : "画布还没有元素"}</p>
        ) : (
          filtered.map((node) => <SidebarItem key={node.id} node={node} onSelect={focusNode} />)
        )}
      </div>

      <div className="sidebar-foot">
        共 {filtered.length}
        {filtered.length === nodes.length ? "" : ` / ${nodes.length}`} 节点
      </div>
    </aside>
  );
}
