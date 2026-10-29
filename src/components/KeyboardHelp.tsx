import { useEffect } from "react";
import { useUiStore } from "../store/uiStore";
import { Modal } from "./ui/Modal";

const GROUPS: { title: string; items: { keys: string[]; action: string }[] }[] = [
  {
    title: "编辑",
    items: [
      { keys: ["Ctrl/Cmd + Z"], action: "撤销" },
      { keys: ["Ctrl/Cmd + Shift + Z"], action: "重做" },
      { keys: ["Ctrl/Cmd + C", "Ctrl/Cmd + V"], action: "复制 / 粘贴" },
      { keys: ["Ctrl/Cmd + D"], action: "复制副本" },
      { keys: ["Delete", "Backspace"], action: "删除选中" },
      { keys: ["Ctrl/Cmd + A"], action: "全选" },
      { keys: ["Ctrl/Cmd + E"], action: "导出 JSON" },
      { keys: ["Ctrl/Cmd + S"], action: "保存到本地存储" },
    ],
  },
  {
    title: "排列",
    items: [
      { keys: ["Ctrl/Cmd + G"], action: "合并分组" },
      { keys: ["Ctrl/Cmd + Shift + G"], action: "取消分组" },
      { keys: ["Ctrl/Cmd + L"], action: "自动布局" },
      { keys: ["方向键"], action: "移动 1px（Shift：10px）" },
      { keys: ["F"], action: "聚焦选中节点" },
    ],
  },
  {
    title: "画布",
    items: [
      { keys: ["双击"], action: "添加文本节点" },
      { keys: ["右键"], action: "打开右键菜单" },
      { keys: ["端口拖到空白"], action: "创建并连接节点" },
      { keys: ["拖入图片"], action: "创建图片节点" },
      { keys: ["Ctrl/Cmd + V"], action: "粘贴图片" },
      { keys: ["点击连线"], action: "编辑标签 / 样式" },
      { keys: ["悬停连线"], action: "删除连线" },
      { keys: ["中键/右键拖拽"], action: "平移画布" },
      { keys: ["左键拖拽"], action: "框选" },
      { keys: ["Shift/Ctrl + 点击"], action: "追加选择" },
      { keys: ["拖拽节点到分组"], action: "加入 / 离开分组" },
      { keys: ["Ctrl/Cmd + 0"], action: "适应视图" },
      { keys: ["/"], action: "命令面板" },
      { keys: ["?"], action: "快捷键面板" },
      { keys: ["Esc"], action: "清除选择 / 关闭面板" },
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
      if (!editable && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        setOpen(!useUiStore.getState().helpOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  if (!open) return null;

  return (
    <Modal onClose={() => setOpen(false)} className="help-modal" labelledBy="help-title">
      <header className="help-head">
        <h2 id="help-title">键盘快捷键</h2>
        <button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="关闭">
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
    </Modal>
  );
}
