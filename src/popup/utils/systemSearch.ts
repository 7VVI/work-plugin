import type { Group, System } from '@shared/types/entities';

export interface SystemSearchSection {
  key: string;
  label: string;
  color?: string;
  systems: System[];
}

function bySort(a: System, b: System): number {
  return a.sort - b.sort;
}

function matchesSystem(system: System, q: string): boolean {
  return system.name.toLowerCase().includes(q) || system.url.toLowerCase().includes(q);
}

/**
 * 构建快捷面板的搜索结果：
 * - 系统名称/URL 直接命中的结果排在前面（收藏优先）；
 * - 分组名称命中的系统追加在后面，按分组分节展示；
 * - 已经直接命中的系统不会在分组结果中重复出现。
 */
export function buildSystemSearchSections(
  systems: System[],
  groups: Group[],
  query: string,
): SystemSearchSection[] {
  const q = query.trim().toLowerCase();
  const sorted = [...systems].sort(bySort);

  if (!q) {
    const favorites = sorted.filter(s => s.favorite);
    const rest = sorted.filter(s => !s.favorite);
    return [
      ...(favorites.length ? [{ key: 'favorite', label: '常用', systems: favorites }] : []),
      ...(rest.length ? [{ key: 'all', label: '全部系统', systems: rest }] : []),
    ];
  }

  const direct = sorted.filter(s => matchesSystem(s, q));
  const directIds = new Set(direct.map(s => s.id));
  const favorites = direct.filter(s => s.favorite);
  const rest = direct.filter(s => !s.favorite);

  const groupSections = [...groups]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt)
    .filter(g => g.name.toLowerCase().includes(q))
    .map(g => ({
      key: `group-${g.id}`,
      label: `分组 · ${g.name}`,
      color: g.color,
      systems: sorted.filter(s => s.groupId === g.id && !directIds.has(s.id)),
    }))
    .filter(section => section.systems.length > 0);

  return [
    ...(favorites.length ? [{ key: 'match-favorite', label: '常用', systems: favorites }] : []),
    ...(rest.length ? [{ key: 'match-all', label: '全部系统', systems: rest }] : []),
    ...groupSections,
  ];
}
