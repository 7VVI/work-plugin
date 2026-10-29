import { describe, it, expect } from 'vitest';
import { buildNoteMenu } from '../../../src/dashboard/components/notes/crepeTable';

interface Item {
  key: string;
  label: string;
  icon?: string;
}

interface Group {
  key: string;
  label: string;
  items: Item[];
}

function fakeBuilder(groups: Group[]) {
  const handle = (group: Group) => ({
    addItem: (key: string, item: { label: string; icon?: string }) => {
      group.items.push({ key, label: item.label, icon: item.icon });
      return handle(group);
    },
  });
  return {
    addGroup: (key: string, label: string) => {
      const group: Group = { key, label, items: [] };
      groups.push(group);
      return handle(group);
    },
    getGroup: (key: string) => {
      const group = groups.find((entry) => entry.key === key);
      if (!group) throw new Error('missing group');
      return handle(group);
    },
  };
}

describe('slash menu table entry', () => {
  it('adds the table item back to the advanced group', () => {
    const groups: Group[] = [{ key: 'advanced', label: '高级', items: [] }];
    buildNoteMenu(fakeBuilder(groups));

    const table = groups[0].items.find((item) => item.key === 'table');
    expect(table?.label).toBe('表格');
    expect(table?.icon).toContain('<svg');
  });

  it('falls back to its own group when the advanced group is missing', () => {
    const groups: Group[] = [];
    buildNoteMenu(fakeBuilder(groups));

    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].key).toBe('table');
  });
});
