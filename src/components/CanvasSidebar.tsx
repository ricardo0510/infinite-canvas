import { useCallback, useMemo, useState, type ReactNode } from "react";
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
          ? "folder"
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

export function CanvasSidebar() {
  const nodes = useCanvasStore((state) => state.nodes);
  const { setCenter, getZoom } = useReactFlow();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const index = useMemo(() => byId(nodes), [nodes]);

  const byParent = useMemo(() => {
    const map = new Map<string | null, CanvasNode[]>();
    for (const node of nodes) {
      const parent =
        node.parentId && index.get(node.parentId)?.type === "group" ? node.parentId : null;
      const siblings = map.get(parent);
      if (siblings) siblings.push(node);
      else map.set(parent, [node]);
    }
    return map;
  }, [nodes, index]);

  const roots = useMemo(() => byParent.get(null) ?? [], [byParent]);

  const visibleIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;

    const ids = new Set<string>();
    const addSubtree = (node: CanvasNode) => {
      ids.add(node.id);
      for (const child of byParent.get(node.id) ?? []) addSubtree(child);
    };
    const visit = (node: CanvasNode): boolean => {
      if (searchText(node).includes(needle)) {
        addSubtree(node);
        return true;
      }
      let matched = false;
      for (const child of byParent.get(node.id) ?? []) {
        if (visit(child)) matched = true;
      }
      if (matched) ids.add(node.id);
      return matched;
    };
    for (const node of roots) visit(node);
    return ids;
  }, [byParent, query, roots]);

  const toggle = useCallback((id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const focusNode = useCallback(
    (node: CanvasNode) => {
      const state = useCanvasStore.getState();
      const rect = nodeRect(node, byId(state.nodes));
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

  const renderNode = (node: CanvasNode, depth: number): ReactNode => {
    if (visibleIds && !visibleIds.has(node.id)) return null;
    const isGroup = node.type === "group";
    const children = byParent.get(node.id) ?? [];
    const expanded = isGroup && (!collapsed.has(node.id) || Boolean(query.trim()));
    const title = nodeTitle(node);

    return (
      <div key={node.id} className="sidebar-tree-node">
        <div className="sidebar-row" style={{ paddingLeft: depth * 14 }}>
          {isGroup ? (
            <button
              type="button"
              className={`sidebar-twisty${expanded ? " is-open" : ""}`}
              aria-label={expanded ? `收起${title}` : `展开${title}`}
              aria-expanded={expanded}
              onClick={() => toggle(node.id)}
            >
              <Icon name="chevron-right" size={12} />
            </button>
          ) : (
            <span className="sidebar-twisty-placeholder" />
          )}
          <button
            type="button"
            className={`sidebar-item${node.selected ? " is-active" : ""}`}
            aria-pressed={node.selected === true}
            title={title}
            onClick={() => focusNode(node)}
          >
            <NodeThumb node={node} />
            <span className="sidebar-item-title">{title}</span>
            {isGroup && children.length > 0 ? (
              <span className="sidebar-folder-count">{children.length}</span>
            ) : null}
          </button>
        </div>
        {isGroup && expanded ? children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    );
  };

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
        {roots.length === 0 ? (
          <p className="sidebar-empty">画布还没有元素</p>
        ) : (
          roots.map((node) => renderNode(node, 0))
        )}
        {query.trim() && visibleIds?.size === 0 ? (
          <p className="sidebar-empty">没有匹配的元素</p>
        ) : null}
      </div>

      <div className="sidebar-foot">
        共 {visibleIds?.size ?? nodes.length}
        {visibleIds ? ` / ${nodes.length}` : ""} 节点
      </div>
    </aside>
  );
}
