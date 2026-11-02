import { Icon } from "../ui/Icon";

export function NodeEmptyState() {
  return (
    <div className="node-empty">
      <span className="node-empty-icon" aria-hidden="true">
        <Icon name="plus" size={14} />
      </span>
      <span>点击输入提示词</span>
    </div>
  );
}
