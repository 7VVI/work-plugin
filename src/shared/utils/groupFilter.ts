/** 虚拟分组：不属于任何自定义分组（groupId 为空）的记录 */
export const UNGROUPED_GROUP_ID = '__ungrouped__';

export function isUngrouped(groupId: string | undefined | null): boolean {
  return !groupId;
}

/** 左侧分组栏的筛选：all / 未分组 / 具体分组 id */
export function matchesGroupFilter(groupId: string | undefined, selected: string): boolean {
  if (selected === 'all') return true;
  if (selected === UNGROUPED_GROUP_ID) return isUngrouped(groupId);
  return groupId === selected;
}
