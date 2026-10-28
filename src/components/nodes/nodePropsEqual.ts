/**
 * React Flow re-renders node components when measured size or absolute position
 * changes. The node content only depends on id/type/selection/dragging/data;
 * position and size are handled by the wrapper.
 */
type ComparableNodeProps = {
  id: string;
  type?: string;
  selected?: boolean;
  dragging?: boolean;
  data?: unknown;
};

export function nodePropsEqual(a: ComparableNodeProps, b: ComparableNodeProps): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.selected === b.selected &&
    a.dragging === b.dragging &&
    a.data === b.data
  );
}
